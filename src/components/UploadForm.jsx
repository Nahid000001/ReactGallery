import React, { useState } from 'react';

const UploadForm = () => {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!file) return alert("Please select a file!");

    try {
      // 1. Upload to Azure Blob Storage — your existing logic here
      const blobUrl = await uploadToAzureBlob(file); // replace this with your actual upload logic

      // 2. Post metadata to Logic App
      await fetch("https://prod-10.northcentralus.logic.azure.com:443/workflows/3fca9f6b8bf74bcd8a157ba...", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "image-" + Date.now(),
          title: "Sunset in Library", // or make it dynamic
          url: blobUrl,
          timestamp: new Date().toISOString()
        })
      });

      alert("Image uploaded and metadata sent!");
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Upload Image</button>
    </div>
  );
};

export default UploadForm;
