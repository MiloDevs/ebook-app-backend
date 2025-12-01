import { Hono } from "hono";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { AppEnv } from "../index.js"; // Adjust path as necessary

const app = new Hono<AppEnv>();

// The upload route matches the UPLOAD_ENDPOINT = "/api/upload" used in your client component.
app.post("/upload", async (c) => {
  const env = c.env;

  // Checking for R2 specific environment variables
  if (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_BUCKET_NAME ||
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY
  ) {
    console.error("R2 configuration missing in environment.");
    return c.json(
      {
        error:
          "R2 service not configured. Missing account ID, bucket name, or credentials.",
      },
      500,
    );
  }

  try {
    const formData = await c.req.formData();
    // 'file' must match the key used in formData.append("file", file) in the client component
    const file = formData.get("book-file") as File;
    const coverFile = formData.get("cover-file") as File;
    const bookTitle = formData.get("book-title") as string;

    if (
      !file ||
      !(file instanceof File) ||
      !coverFile ||
      !(coverFile instanceof File)
    ) {
      return c.json(
        {
          error:
            "No file provided or invalid file format for file or coverFile.",
        },
        400,
      );
    }

    // 1. Configure S3 Client for R2
    const s3 = new S3Client({
      // R2 requires a custom endpoint built using your Account ID
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,

      // Region is required by the SDK but often a dummy value like 'auto' for R2
      region: process.env.AWS_REGION || "auto",

      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },

      // Setting forcePathStyle to true is often necessary for R2 compatibility
      forcePathStyle: true,
    });

    let cleanedBookTitle = bookTitle
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    // Generate a unique key for the file to prevent collisions
    const fileExtension = file.name.split(".").pop();
    const coverFileExtension = coverFile.name.split(".").pop();
    // Using a UUID for unique file naming
    const uniqueBookKey = `${crypto.randomUUID()}.${fileExtension}`;
    const uniqueCoverKey = `${crypto.randomUUID()}.${coverFileExtension}`;

    // 2. Prepare file content (convert File object to a Buffer/ArrayBuffer)
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const coverFileBuffer = Buffer.from(await coverFile.arrayBuffer());

    // 3. Define R2 upload parameters
    const fileuploadParams = {
      Bucket: process.env.R2_BUCKET_NAME, // Use R2_BUCKET_NAME from environment
      Key: `books/${cleanedBookTitle}/${uniqueBookKey}`, // Unique Key for the book file
      Body: fileBuffer,
      ContentType: file.type,
    };

    const coveruploadParams = {
      Bucket: process.env.R2_BUCKET_NAME, // Use R2_BUCKET_NAME from environment
      Key: `books/${cleanedBookTitle}/${uniqueCoverKey}`, // Unique Key for the cover file
      Body: coverFileBuffer,
      ContentType: coverFile.type,
    };

    // 4. Upload the files
    // Upload Book File
    const command = new PutObjectCommand(fileuploadParams);
    await s3.send(command);

    // Upload Cover File
    const coverCommand = new PutObjectCommand(coveruploadParams);
    await s3.send(coverCommand);

    const encodedTitle = encodeURIComponent(cleanedBookTitle);

    const file_url = `https://cdn.milo-the.dev/books/${encodedTitle}/${uniqueBookKey}`;

    const cover_url = `https://cdn.milo-the.dev/books/${encodedTitle}/${uniqueCoverKey}`;

    // 6. Return the URLs to the client component
    return c.json({
      message: "Files uploaded successfully to R2",
      bookTitle: bookTitle, // Optionally return the title
      file_url: file_url,
      cover_url: cover_url, // Return the cover URL
    });
  } catch (error) {
    // Ensuring the error message is descriptive
    console.error("R2 Upload Error:", error);
    return c.json(
      { error: `File upload failed due to R2 error: ${error.message}` },
      500,
    );
  }
});

export default app;
