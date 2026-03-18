const express = require('express');
const axios = require('axios');
const fileUpload = require('express-fileupload');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());
app.use(fileUpload({
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  useTempFiles: false,
}));

app.post('/upload', async (req, res) => {
  const { connectionId, language = 'en' } = req.query;

  if (!connectionId) {
    return res.status(400).json({ error: 'connectionId is required' });
  }

  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const uploadedFile = req.files.file;

  try {
    console.log(`Getting upload URL for connectionId: ${connectionId}, language: ${language}, filename: ${uploadedFile.name}`);

    // Step 1: Get the signed S3 upload URL
    const uploadUrlResponse = await axios.get(
      `https://stt-landpage-file-upload.riverside.fm/v1/audio/${uploadedFile.name}?connectionId=${connectionId}&language=${language}`
    );

    const uploadUrl = uploadUrlResponse.data.upload_url;
    console.log(`Received upload URL: ${uploadUrl}`);

    if (!uploadUrl) {
      throw new Error('Upload URL not received from API');
    }

    // Step 2: PUT the binary file to S3
    console.log(`Uploading ${uploadedFile.size} bytes to S3...`);

    const uploadResponse = await axios.put(uploadUrl, uploadedFile.data, {
      headers: {
        'Content-Type': uploadedFile.mimetype || 'video/mp4',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log('File uploaded successfully to S3:', uploadResponse.status);

    res.json({
      success: true,
      message: 'File uploaded and transcription started',
      filename: uploadedFile.name,
      size: uploadedFile.size,
      connectionId,
      language,
    });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});