/** @jsxImportSource hono/jsx */
import { type FC, useState, useEffect, useCallback, useRef } from "hono/jsx";
import { render } from "hono/jsx/dom";

// --- Type Definitions (Must match your backend models) ---

interface Book {
  id: string;
  title: string;
  image_url: string | null;
  file_url: string | null;
  description: string | null;
  best_selling: boolean;
  recommended: boolean;
  rating: number | null;
  released_at: string | null;
  author_id: string;
  author?: { id: string; full_name: string };
  genres?: { id: string; title: string }[];
}

interface BookFormData {
  title: string;
  description: string;
  image_url: string; // URL for the cover image (could be base64 if server extracts it)
  rating: string;
  best_selling: boolean;
  recommended: boolean;
  released_at: string;
  author_id: string;
  // Temporary field used only for step 2 submission
  temp_file_url?: string;
}

interface ServerMetadata {
  title: string;
  description: string;
  rating: string;
  released_at: string;
  author_id: string;
  image_url?: string; // Optional cover image URL (e.g., base64 or temporary URL)
  temp_file_url: string; // The R2 URL where the file is temporarily stored
}

// --- Component: Custom Confirmation/Alert Modal (Replaces alert() and confirm()) ---

const CustomModal: FC<{
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  isConfirm: boolean;
}> = ({ message, onConfirm, onCancel, isConfirm }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex justify-center items-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {isConfirm ? "Confirmation" : "Notification"}
          </h3>
          <p className="text-gray-700 mb-6">{message}</p>
          <div className="flex justify-end space-x-3">
            {isConfirm && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
              >
                Cancel
              </button>
            )}
            <button
              onClick={onConfirm || onCancel}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                isConfirm
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isConfirm ? "Confirm" : "OK"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Component: FileUploadInput (Tailwind Styled) ---

const FileUploadInput: FC<{
  uploadUrl: string;
  onUploadComplete: (metadata: ServerMetadata) => void;
  buttonText: string;
  setAlert: (msg: string) => void;
}> = ({ uploadUrl, onUploadComplete, buttonText, setAlert }) => {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    setIsUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl, true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          setIsUploading(false);
          setProgress(0);

          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.temp_file_url && response.metadata) {
              setAlert("File uploaded successfully. Please review the extracted metadata.");
              
              // We combine the server metadata with the temporary URL for the next step
              const fullMetadata: ServerMetadata = {
                  ...response.metadata,
                  temp_file_url: response.temp_file_url,
              };
              onUploadComplete(fullMetadata);
            } else {
              setAlert("Upload successful, but server did not return file URL or metadata.");
            }
          } else {
            console.error("Upload failed:", xhr.responseText);
            setAlert("File upload failed. Status: " + xhr.status + ". " + JSON.parse(xhr.responseText).error);
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      };

      xhr.send(formData);
    } catch (error) {
      console.error("Error during upload:", error);
      setIsUploading(false);
      setProgress(0);
      setAlert("An error occurred during file upload.");
    }
  };

  return (
    <div className="mt-1">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange as any}
        disabled={isUploading}
        accept=".pdf,.epub"
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className={`w-full px-4 py-2 rounded-lg font-medium transition duration-150 ease-in-out
          ${isUploading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"}`}
      >
        {isUploading ? `Uploading... ${progress}%` : buttonText}
      </button>
      {isUploading && (
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-green-600 h-2.5 rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

// --- Main Page Component ---

const BooksPage: FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [formData, setFormData] = useState<Partial<BookFormData>>({});
  
  // State for the two-step upload process
  const [tempFileUrl, setTempFileUrl] = useState<string | null>(null);
  
  // State for Custom Modal
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Correcting the endpoint paths
  const UPLOAD_ENDPOINT = "/api/upload"; // Initial file upload/parsing
  const BOOKS_ENDPOINT = "/api/books"; // CRUD operations

  // --- Data Fetching ---

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Note: Must match the route defined in index.ts for books, e.g., /api/books
      const response = await fetch(BOOKS_ENDPOINT); 
      const data = await response.json();
      if (response.ok) {
        setBooks(data.books || []);
      } else {
        setError("Failed to fetch books: " + JSON.stringify(data.error));
      }
    } catch (err) {
      setError("Network error while fetching books.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // --- Modal Helpers ---

  const handleAlert = (msg: string) => setAlertMessage(msg);
  const handleConfirm = (msg: string, onConfirm: () => void) => {
    setConfirmAction({ message: msg, onConfirm });
  };
  const closeAlert = () => setAlertMessage(null);
  const closeConfirm = () => setConfirmAction(null);

  // --- Two-Step Upload Handler ---
  
  const handleTempUploadComplete = (metadata: ServerMetadata) => {
      // 1. Set the temporary URL
      setTempFileUrl(metadata.temp_file_url);
      
      // 2. Prefill the form with server-extracted metadata
      setFormData({
          title: metadata.title || "Untitled Book",
          description: metadata.description || "",
          image_url: metadata.image_url || "", // This might be a base64 or temp R2 link
          rating: metadata.rating || "",
          released_at: metadata.released_at ? metadata.released_at.substring(0, 10) : "",
          author_id: metadata.author_id || "unknown-author",
          best_selling: false, // Default flags
          recommended: false, // Default flags
      });
      
      // Keep modal open, but switch it to 'Create New Book' view
      setCurrentBook(null); 
      setModalOpen(true);
  };


  // --- Form Handlers ---

  const handleInputChange = (e: Event) => {
    const target = e.target as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement;
    const { name, value, type } = target;
    const isCheckbox = type === "checkbox";

    setFormData((prev) => ({
      ...prev,
      [name]: isCheckbox ? (target as HTMLInputElement).checked : value,
    }));
  };

  const openModal = (book: Book | null = null) => {
    setCurrentBook(book);
    setTempFileUrl(book?.file_url || null); // Reuse file_url if editing

    if (book) {
      setFormData({
        title: book.title,
        description: book.description || "",
        image_url: book.image_url || "",
        rating: book.rating ? String(book.rating) : "",
        best_selling: book.best_selling,
        recommended: book.recommended,
        released_at: book.released_at ? book.released_at.substring(0, 10) : "",
        author_id: book.author_id,
      });
      setModalOpen(true);
    } else {
      // When adding a new book, first show the upload step
      setModalOpen(true);
      setFormData({
        title: "",
        description: "",
        image_url: "",
        rating: "",
        best_selling: false,
        recommended: false,
        released_at: "",
        author_id: "default-author-id",
      });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setCurrentBook(null);
    setFormData({});
    setTempFileUrl(null);
    // Also close any confirmation/alert modals
    closeAlert();
    closeConfirm();
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title || !formData.author_id) {
        handleAlert("Title and Author ID are required.");
        return;
    }

    const payload = {
      ...formData,
      rating: formData.rating ? parseFloat(formData.rating) : undefined,
      released_at: formData.released_at
        ? new Date(formData.released_at).toISOString()
        : undefined,
      // Pass the temporary file URL if we are creating a book from a new upload
      // Otherwise, file_url (if present) is already stored on the server.
      file_url: currentBook ? currentBook.file_url : tempFileUrl, 
    };

    try {
      let response;
      // If we are editing, currentBook is defined.
      // If we are creating, currentBook is null, and we rely on tempFileUrl.
      const method = currentBook ? "PUT" : "POST";
      const url = currentBook
        ? `${BOOKS_ENDPOINT}/${currentBook.id}`
        : BOOKS_ENDPOINT;

      response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        handleAlert(
          currentBook
            ? "Book updated successfully!"
            : "Book created successfully!",
        );
        closeModal();
        fetchBooks();
      } else {
        setError(`Operation failed: ${JSON.stringify(data.error)}`);
        handleAlert(`Operation failed: ${JSON.stringify(data.error)}`);
      }
    } catch (err) {
      setError("Network error during book operation.");
      handleAlert("Network error during book operation.");
      console.error(err);
    }
  };

  const handleDelete = (id: string) => {
    const performDelete = async () => {
        closeConfirm();
        try {
            const response = await fetch(`${BOOKS_ENDPOINT}/${id}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (response.ok) {
                handleAlert("Book deleted successfully!");
                fetchBooks();
            } else {
                setError(`Deletion failed: ${JSON.stringify(data.error)}`);
                handleAlert(`Deletion failed: ${JSON.stringify(data.error)}`);
            }
        } catch (err) {
            setError("Network error during deletion.");
            handleAlert("Network error during deletion.");
            console.error(err);
        }
    };
    
    handleConfirm("Are you sure you want to delete this book?", performDelete);
  };

  // --- Rendering ---

  if (loading)
    return (
      <div className="text-center p-10 text-xl text-gray-600 flex flex-col items-center">
        <svg
          className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        Loading Books...
      </div>
    );
  if (error)
    return (
      <div className="text-red-600 text-center p-6 bg-red-100 border border-red-400 rounded-lg mx-auto max-w-lg mt-5">
        Error: {error}
      </div>
    );

  return (
    <div className="font-sans p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 border-b-2 border-gray-200 pb-4 mb-6">
        📚 Book Management
      </h1>
      <button
        className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-150 font-semibold"
        onClick={() => openModal()}
      >
        + Add New Book
      </button>

      <hr className="my-6 border-gray-200" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {books.length === 0 ? (
          <p className="col-span-full text-center text-gray-500 p-5">
            No books found. Add one above!
          </p>
        ) : (
          books.map((book) => (
            <div
              key={book.id}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-lg hover:shadow-xl transition duration-300"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-semibold text-gray-800 break-words pr-2">
                  {book.title}
                </h3>
                <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  {book.rating ? `⭐ ${book.rating}` : "N/A"}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                <strong className="font-medium text-gray-600">
                  Author ID:
                </strong>{" "}
                {book.author_id}
              </p>
              {book.file_url && (
                <a 
                  href={book.file_url} 
                  target="_blank" 
                  className="inline-flex items-center text-blue-600 text-xs font-medium hover:text-blue-800 transition mb-3"
                  rel="noopener noreferrer"
                >
                  View File
                </a>
              )}
              <div className="mb-4">
                {book.best_selling && (
                  <span className="inline-block mr-2 px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                    Best Seller
                  </span>
                )}
                {book.recommended && (
                  <span className="inline-block px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                    Recommended
                  </span>
                )}
              </div>
              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => openModal(book)}
                  className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(book.id)}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- Main Modal for Create/Update --- */}
      {modalOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-6">
                {currentBook ? "Edit Book" : "Add New Book"}
              </h2>

              {/* Step 1: File Upload (Only for New Books or if no file is attached/being replaced) */}
              {!currentBook && !tempFileUrl && (
                  <div className="space-y-4 mb-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
                      <p className="text-sm text-blue-800 font-medium">
                          Step 1: Upload your EPUB or PDF file to extract metadata.
                      </p>
                      <FileUploadInput
                          uploadUrl={UPLOAD_ENDPOINT}
                          onUploadComplete={handleTempUploadComplete}
                          buttonText="Upload Book File (.pdf, .epub)"
                          setAlert={handleAlert}
                      />
                  </div>
              )}

              {/* Step 2: Metadata Review/Edit (For Edits or Post-Upload Review) */}
              {(currentBook || tempFileUrl) && (
                  <form onSubmit={handleSubmit as any}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                          {/* Column 1: Core Metadata */}
                          <div className="space-y-4">
                              <label className="block">
                                  <span className="text-sm font-semibold text-gray-700">
                                      Title:
                                  </span>
                                  <input
                                      type="text"
                                      name="title"
                                      value={formData.title || ""}
                                      onChange={handleInputChange as any}
                                      className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                      required
                                  />
                              </label>

                              <label className="block">
                                  <span className="text-sm font-semibold text-gray-700">
                                      Author ID:
                                  </span>
                                  <input
                                      type="text"
                                      name="author_id"
                                      value={formData.author_id || ""}
                                      onChange={handleInputChange as any}
                                      className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                      required
                                  />
                              </label>

                              <label className="block">
                                  <span className="text-sm font-semibold text-gray-700">
                                      Rating (1-5):
                                  </span>
                                  <input
                                      type="number"
                                      name="rating"
                                      min="1"
                                      max="5"
                                      step="0.1"
                                      value={formData.rating || ""}
                                      onChange={handleInputChange as any}
                                      className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                              </label>

                              <label className="block">
                                  <span className="text-sm font-semibold text-gray-700">
                                      Release Date:
                                  </span>
                                  <input
                                      type="date"
                                      name="released_at"
                                      value={formData.released_at || ""}
                                      onChange={handleInputChange as any}
                                      className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                              </label>

                              <div className="flex space-x-6 pt-2">
                                  <label className="flex items-center text-sm font-normal text-gray-700">
                                      <input
                                          type="checkbox"
                                          name="best_selling"
                                          checked={!!formData.best_selling}
                                          onChange={handleInputChange as any}
                                          className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                      />
                                      Best Selling
                                  </label>
                                  <label className="flex items-center text-sm font-normal text-gray-700">
                                      <input
                                          type="checkbox"
                                          name="recommended"
                                          checked={!!formData.recommended}
                                          onChange={handleInputChange as any}
                                          className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                      />
                                      Recommended
                                  </label>
                              </div>
                          </div>

                          {/* Column 2: Optional/Large Fields */}
                          <div className="space-y-4">
                              <label className="block">
                                  <span className="text-sm font-semibold text-gray-700">
                                      Image URL (Cover):
                                  </span>
                                  <input
                                      type="text"
                                      name="image_url"
                                      value={formData.image_url || ""}
                                      onChange={handleInputChange as any}
                                      className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                              </label>

                              <label className="block">
                                  <span className="text-sm font-semibold text-gray-700">
                                      Description:
                                  </span>
                                  <textarea
                                      name="description"
                                      value={formData.description || ""}
                                      onChange={handleInputChange as any}
                                      rows={4}
                                      className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                                  ></textarea>
                              </label>

                              <div className="pt-2 border-t border-gray-200">
                                  <h3 className="text-base font-semibold text-gray-800 mb-2">
                                      Book File Status
                                  </h3>
                                  <p className="text-xs text-gray-500 mb-3 truncate">
                                      {currentBook 
                                          ? `Existing File: ${currentBook.file_url ? 'Attached' : 'None'}`
                                          : tempFileUrl
                                              ? `Temp File Attached: ${tempFileUrl}`
                                              : "No file attached."
                                      }
                                  </p>
                                  <FileUploadInput
                                      uploadUrl={UPLOAD_ENDPOINT}
                                      onUploadComplete={handleTempUploadComplete}
                                      buttonText={tempFileUrl || currentBook?.file_url ? "Replace File" : "Upload File"}
                                      setAlert={handleAlert}
                                  />
                              </div>
                          </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-8 pt-4 border-t border-gray-200 flex justify-end space-x-3">
                          <button
                              type="submit"
                              className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-150 font-semibold"
                          >
                              {currentBook ? "Save Changes" : "Finalize & Create Book"}
                          </button>
                          <button
                              type="button"
                              onClick={closeModal}
                              className="px-5 py-2 bg-gray-500 text-white rounded-lg shadow-md hover:bg-gray-600 transition duration-150 font-semibold"
                          >
                              Cancel
                          </button>
                      </div>
                  </form>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Global Alert/Confirmation Modals */}
      {alertMessage && (
          <CustomModal 
              message={alertMessage} 
              onCancel={closeAlert}
              isConfirm={false} 
          />
      )}
      {confirmAction && (
          <CustomModal 
              message={confirmAction.message} 
              onConfirm={confirmAction.onConfirm} 
              onCancel={closeConfirm}
              isConfirm={true} 
          />
      )}
    </div>
  );
};

function App() {
  return (
    <div>
      <BooksPage />
    </div>
  );
}

// Assumes 'root' element exists in the HTML page.
const root = document.getElementById("root")!;
render(<App />, root);