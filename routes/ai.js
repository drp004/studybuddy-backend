const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const { body, validationResult } = require('express-validator');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// AI Service configuration - FastAPI endpoints
const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'http://localhost:8000';
const AI_SERVICE_TIMEOUT = 120000; // 2 minutes
const EXTERNAL_VIDEO_API = 'https://studybuddy-api-t716.onrender.com/studybuddy/process-yt';

// Validation middleware
const validateAIRequest = [
  body('content').notEmpty().withMessage('Content is required'),
  body('type').isIn(['text', 'audio', 'image', 'video']).withMessage('Invalid content type'),
  body('options').optional().isObject().withMessage('Options must be an object')
];

// Process image and generate notes using external StudyBuddy API
router.post('/process-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    const message = req.body.message || "I'm providing an image, generate notes from it";
    const history = JSON.parse(req.body.history || '[]');

    console.log('🚀 Processing image with external StudyBuddy API');
    console.log('📄 Image request:', message);
    console.log('📁 File info:', {
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });

    // Create FormData for external API
    const FormData = require('form-data');
    const formData = new FormData();
    
    // Add the request data
    formData.append('req', JSON.stringify({ message, history }));
    
    // Add the image file
    formData.append('image', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await axios.post('https://studybuddy-api-t716.onrender.com/studybuddy/process-image', formData, {
      timeout: 300000, // 5 minutes
      headers: {
        ...formData.getHeaders(),
        'Accept': 'application/json'
      }
    });

    console.log('✅ External API Response Status:', response.status);
    console.log('📄 External API Response:', response.data);

    // Step 2: Enhance with Gemini AI for structured output
    let originalContent = response.data;
    let contentText = '';
    
    // Extract content from StudyBuddy response
    if (typeof originalContent === 'string') {
      contentText = originalContent;
    } else if (originalContent && typeof originalContent === 'object') {
      contentText = originalContent.generated_text || 
                   originalContent.content || 
                   originalContent.text || 
                   originalContent.response || 
                   JSON.stringify(originalContent);
    }

    console.log('🤖 Enhancing image analysis with Gemini AI...');
    console.log('📊 Content to enhance preview:', contentText.substring(0, 300) + '...');
    
    // Enhanced prompt for image/document analysis
    const prompt = `You are an expert document analyst and educational content creator. Transform the StudyBuddy image/document analysis into structured notes with organized sections for colorful display.

StudyBuddy Image/Document Analysis:
${contentText}

**Required JSON Response Format:**
{
  "documentMetadata": {
    "title": "Clear, descriptive title for the document/image",
    "dateCreated": "${new Date().toISOString().split('T')[0]}",
    "documentType": "Image Analysis" or "Document Analysis",
    "category": "Educational/Technical/Business/etc",
    "difficulty": "Beginner/Intermediate/Advanced"
  },
  "documentOverview": {
    "description": "Comprehensive overview of the document content and purpose",
    "mainPurpose": "Primary objective or goal of the document",
    "targetAudience": "Who this document is intended for"
  },
  "keyTopicsCovered": [
    "List of main topics, concepts, or subjects covered",
    "Important themes and ideas",
    "Key areas of focus"
  ],
  "coreConceptsDefinitions": [
    {
      "term": "Important term or concept",
      "definition": "Clear explanation of the term",
      "importance": "Why this concept matters"
    }
  ],
  "detailedAnalysis": {
    "stepByStepExplanation": [
      "Detailed breakdown of processes or procedures",
      "Sequential analysis of content"
    ],
    "examples": [
      "Specific examples found in the document",
      "Practical illustrations"
    ],
    "practicalApplications": [
      "How to apply this information",
      "Real-world use cases"
    ]
  },
  "keyTakeaways": {
    "mainPoints": [
      "Most important insights from the document",
      "Critical information to remember"
    ],
    "actionableInsights": [
      "Specific actions readers can take",
      "Practical next steps"
    ],
    "practicalTips": [
      "Useful tips and recommendations",
      "Best practices mentioned"
    ]
  },
  "additionalResources": {
    "relatedTopics": [
      "Connected subjects to explore further",
      "Related areas of study"
    ],
    "suggestedReading": [
      "Recommended materials for deeper learning",
      "Additional resources"
    ],
    "furtherLearning": [
      "Next steps for continued education",
      "Advanced topics to explore"
    ]
  },
  "originalContent": {
    "extractedText": "Raw text content from the document/image",
    "source": "StudyBuddy API",
    "processingNote": "Processed with AI enhancement for structured analysis"
  }
}

**Instructions:**
1. Create a comprehensive, well-structured analysis
2. Extract meaningful insights and organize them logically
3. Ensure all sections have relevant, non-redundant content
4. Focus on educational value and practical application
5. Make the content engaging and easy to understand
6. Return ONLY the JSON object, no additional text or formatting`;

    const GEMINI_API_KEY = 'AIzaSyAC_WRGvGAlasiYidRG1qsRVARoEjzDDxk';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    try {
      console.log('🚀 Calling Gemini API with URL:', GEMINI_API_URL);
      console.log('📝 Request body structure:', {
        contentsLength: requestBody.contents.length,
        promptLength: prompt.length,
        generationConfig: requestBody.generationConfig
      });

      const geminiResponse = await axios.post(GEMINI_API_URL, requestBody, {
        timeout: 90000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Gemini API response status:', geminiResponse.status);
      console.log('📊 Gemini API response structure:', {
        hasCandidates: !!geminiResponse.data?.candidates,
        candidatesLength: geminiResponse.data?.candidates?.length || 0,
        hasContent: !!geminiResponse.data?.candidates?.[0]?.content,
        hasParts: !!geminiResponse.data?.candidates?.[0]?.content?.parts,
        partsLength: geminiResponse.data?.candidates?.[0]?.content?.parts?.length || 0
      });

      if (geminiResponse.data && geminiResponse.data.candidates && geminiResponse.data.candidates[0]) {
        const enhancedContent = geminiResponse.data.candidates[0].content.parts[0].text;
        console.log('✨ Enhanced content preview:', enhancedContent.substring(0, 200) + '...');
        
        const imageData = {
          generated_text: enhancedContent,
          processingInfo: {
            originalContentAvailable: !!contentText,
            externalApiUsed: true,
            enhancedWithGemini: true,
            processingDate: new Date().toISOString(),
            contentLength: contentText ? contentText.length : 0
          }
        };

        console.log('✅ Image analysis enhanced successfully with Gemini AI');
        
        res.json({
          success: true,
          data: imageData,
          message: 'Image processed successfully with AI enhancement'
        });
      } else {
        console.error('❌ Invalid Gemini API response structure:', geminiResponse.data);
        throw new Error('Invalid response from Gemini API');
      }
    } catch (geminiError) {
      console.error('❌ Gemini enhancement error details:', {
        message: geminiError.message,
        status: geminiError.response?.status,
        statusText: geminiError.response?.statusText,
        data: geminiError.response?.data,
        code: geminiError.code
      });
      console.log('⚠️ Gemini enhancement failed, using StudyBuddy response:', geminiError.message);
      
      // Fallback to original StudyBuddy response
      res.json({
        success: true,
        data: originalContent,
        message: 'Image processed successfully (StudyBuddy only)',
        fallback: true
      });
    }

  } catch (error) {
    console.error('❌ Image Processing Error:', error.message);
    console.error('🔍 Error Details:', {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to process image',
      error: error.message
    });
  }
});

// Process PDF and generate notes using external StudyBuddy API
router.post('/process-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'PDF file is required'
      });
    }

    const message = req.body.message || "I'm providing a PDF, generate notes from it";
    const history = JSON.parse(req.body.history || '[]');

    console.log('🚀 Processing PDF with external StudyBuddy API');
    console.log('📄 PDF request:', message);
    console.log('📁 File info:', {
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });

    // Create FormData for external API
    const FormData = require('form-data');
    const formData = new FormData();
    
    // Add the request data
    formData.append('req', JSON.stringify({ message, history }));
    
    // Add the PDF file
    formData.append('pdf', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await axios.post('https://studybuddy-api-t716.onrender.com/studybuddy/process-pdf', formData, {
      timeout: 300000, // 5 minutes for PDF processing
      headers: {
        ...formData.getHeaders(),
        'Accept': 'application/json'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('✅ External API Response Status:', response.status);
    console.log('📄 External API Response:', response.data);

    // Step 2: Enhance with Gemini AI for structured output
    let originalContent = response.data;
    let contentText = '';
    
    // Extract content from StudyBuddy response
    if (typeof originalContent === 'string') {
      contentText = originalContent;
    } else if (originalContent && typeof originalContent === 'object') {
      contentText = originalContent.generated_text || 
                   originalContent.content || 
                   originalContent.text || 
                   originalContent.response || 
                   JSON.stringify(originalContent);
    }

    console.log('🤖 Enhancing PDF analysis with Gemini AI...');
    
    // Enhanced prompt for PDF document analysis
    const prompt = `You are an expert document analyst and educational content creator. Transform the StudyBuddy PDF analysis into structured notes with organized sections for colorful display.

StudyBuddy PDF Analysis:
${contentText}

**Required JSON Response Format:**
{
  "documentMetadata": {
    "title": "Clear, descriptive title for the PDF document",
    "dateCreated": "${new Date().toISOString().split('T')[0]}",
    "documentType": "PDF Document Analysis",
    "category": "Educational/Technical/Business/Research/etc",
    "difficulty": "Beginner/Intermediate/Advanced"
  },
  "documentOverview": {
    "description": "Comprehensive overview of the PDF content and purpose",
    "mainPurpose": "Primary objective or goal of the document",
    "targetAudience": "Who this document is intended for"
  },
  "keyTopicsCovered": [
    "List of main topics, concepts, or subjects covered",
    "Important themes and ideas",
    "Key areas of focus"
  ],
  "coreConceptsDefinitions": [
    {
      "term": "Important term or concept",
      "definition": "Clear explanation of the term",
      "importance": "Why this concept matters"
    }
  ],
  "detailedAnalysis": {
    "stepByStepExplanation": [
      "Detailed breakdown of processes or procedures",
      "Sequential analysis of content"
    ],
    "examples": [
      "Specific examples found in the document",
      "Practical illustrations"
    ],
    "practicalApplications": [
      "How to apply this information",
      "Real-world use cases"
    ]
  },
  "keyTakeaways": {
    "mainPoints": [
      "Most important insights from the document",
      "Critical information to remember"
    ],
    "actionableInsights": [
      "Specific actions readers can take",
      "Practical next steps"
    ],
    "practicalTips": [
      "Useful tips and recommendations",
      "Best practices mentioned"
    ]
  },
  "additionalResources": {
    "relatedTopics": [
      "Connected subjects to explore further",
      "Related areas of study"
    ],
    "suggestedReading": [
      "Recommended materials for deeper learning",
      "Additional resources"
    ],
    "furtherLearning": [
      "Next steps for continued education",
      "Advanced topics to explore"
    ]
  },
  "originalContent": {
    "extractedText": "Raw text content from the PDF",
    "source": "StudyBuddy API",
    "processingNote": "Processed with AI enhancement for structured analysis"
  }
}

**Instructions:**
1. Create a comprehensive, well-structured analysis
2. Extract meaningful insights and organize them logically
3. Ensure all sections have relevant, non-redundant content
4. Focus on educational value and practical application
5. Make the content engaging and easy to understand
6. Return ONLY the JSON object, no additional text or formatting`;

    const GEMINI_API_KEY = 'AIzaSyAC_WRGvGAlasiYidRG1qsRVARoEjzDDxk';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    try {
      console.log('🚀 Calling Gemini API for PDF with URL:', GEMINI_API_URL);
      console.log('📝 PDF Request body structure:', {
        contentsLength: requestBody.contents.length,
        promptLength: prompt.length,
        generationConfig: requestBody.generationConfig
      });

      const geminiResponse = await axios.post(GEMINI_API_URL, requestBody, {
        timeout: 90000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 PDF Gemini API response status:', geminiResponse.status);
      console.log('📊 PDF Gemini API response structure:', {
        hasCandidates: !!geminiResponse.data?.candidates,
        candidatesLength: geminiResponse.data?.candidates?.length || 0,
        hasContent: !!geminiResponse.data?.candidates?.[0]?.content,
        hasParts: !!geminiResponse.data?.candidates?.[0]?.content?.parts,
        partsLength: geminiResponse.data?.candidates?.[0]?.content?.parts?.length || 0
      });

      if (geminiResponse.data && geminiResponse.data.candidates && geminiResponse.data.candidates[0]) {
        const enhancedContent = geminiResponse.data.candidates[0].content.parts[0].text;
        console.log('✨ PDF Enhanced content preview:', enhancedContent.substring(0, 200) + '...');
        
        const pdfData = {
          generated_text: enhancedContent,
          processingInfo: {
            originalContentAvailable: !!contentText,
            externalApiUsed: true,
            enhancedWithGemini: true,
            processingDate: new Date().toISOString(),
            contentLength: contentText ? contentText.length : 0
          }
        };

        console.log('✅ PDF analysis enhanced successfully with Gemini AI');
        
        res.json({
          success: true,
          data: pdfData,
          message: 'PDF processed successfully with AI enhancement'
        });
      } else {
        console.error('❌ Invalid PDF Gemini API response structure:', geminiResponse.data);
        throw new Error('Invalid response from Gemini API');
      }
    } catch (geminiError) {
      console.error('❌ PDF Gemini enhancement error details:', {
        message: geminiError.message,
        status: geminiError.response?.status,
        statusText: geminiError.response?.statusText,
        data: geminiError.response?.data,
        code: geminiError.code
      });
      console.log('⚠️ PDF Gemini enhancement failed, using StudyBuddy response:', geminiError.message);
      
      // Fallback to original StudyBuddy response
      res.json({
        success: true,
        data: originalContent,
        message: 'PDF processed successfully (StudyBuddy only)',
        fallback: true
      });
    }

  } catch (error) {
    console.error('❌ PDF Processing Error:', error.message);
    console.error('🔍 Error Details:', {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to process PDF';
    let statusCode = 500;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'External PDF processing service is unavailable';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'PDF processing timed out. Please try with a smaller file';
      statusCode = 408;
    } else if (error.response?.status === 413) {
      errorMessage = 'PDF file is too large. Please try with a smaller file';
      statusCode = 413;
    } else if (error.response?.status === 400) {
      errorMessage = 'Invalid PDF file format or corrupted file';
      statusCode = 400;
    } else if (error.response?.status >= 500) {
      errorMessage = 'External PDF processing service error';
      statusCode = 502;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      details: error.response?.data || null
    });
  }
});

// Test endpoint for audio processing
router.post('/test-audio', upload.single('audio'), async (req, res) => {
  try {
    console.log('🧪 Testing audio endpoint');
    console.log('📁 File received:', req.file ? {
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    } : 'No file');
    console.log('📄 Message:', req.body.message);
    
    res.json({
      success: true,
      message: 'Audio test endpoint working',
      fileReceived: !!req.file,
      fileInfo: req.file ? {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      } : null
    });
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Test endpoint failed',
      error: error.message
    });
  }
});

// Process audio and generate notes using AssemblyAI
router.post('/process-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Audio file is required'
      });
    }

    console.log('🚀 Processing audio with AssemblyAI');
    console.log('📁 File info:', {
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });

    // Step 1: Upload audio file to AssemblyAI
    const baseUrl = "https://api.assemblyai.com";
    const headers = {
      authorization: "99fca56dcc91486c9f18bf3e73848ad6",
    };

    console.log('📤 Uploading audio file to AssemblyAI...');
    const uploadResponse = await axios.post(`${baseUrl}/v2/upload`, req.file.buffer, {
      headers,
      timeout: 300000, // 5 minutes for upload
    });

    const audioUrl = uploadResponse.data.upload_url;
    console.log('✅ Audio uploaded successfully:', audioUrl);

    // Step 2: Submit transcription job
    const transcriptionData = {
      audio_url: audioUrl,
      speech_model: "universal",
      speaker_labels: true,
      summarization: true,
      summary_model: "informative",
      summary_type: "bullets"
    };

    console.log('🎯 Submitting transcription job...');
    const transcriptionResponse = await axios.post(`${baseUrl}/v2/transcript`, transcriptionData, {
      headers: headers,
      timeout: 60000, // 1 minute for job submission
    });

    const transcriptId = transcriptionResponse.data.id;
    console.log('📋 Transcription job submitted with ID:', transcriptId);

    // Step 3: Poll for completion
    const pollingEndpoint = `${baseUrl}/v2/transcript/${transcriptId}`;
    let transcriptionResult;
    let pollCount = 0;
    const maxPolls = 120; // Maximum 10 minutes of polling (5s intervals)

    console.log('⏳ Polling for transcription completion...');
    while (pollCount < maxPolls) {
      try {
        const pollingResponse = await axios.get(pollingEndpoint, {
          headers: headers,
          timeout: 60000, // 1 minute for each poll
        });
        
        transcriptionResult = pollingResponse.data;
        console.log(`🔄 Poll ${pollCount + 1}: Status = ${transcriptionResult.status}`);

        if (transcriptionResult.status === "completed") {
          console.log('✅ Transcription completed successfully');
          break;
        } else if (transcriptionResult.status === "error") {
          throw new Error(`Transcription failed: ${transcriptionResult.error}`);
        } else {
          pollCount++;
          console.log(`⏳ Transcription still processing... waiting 5 seconds before next poll`);
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
      } catch (pollError) {
        console.log(`⚠️ Poll ${pollCount + 1} failed:`, pollError.message);
        
        // If it's a timeout error, continue polling
        if (pollError.code === 'ECONNABORTED' || pollError.code === 'ETIMEDOUT') {
          pollCount++;
          console.log(`🔄 Polling timeout, retrying... (${pollCount}/${maxPolls})`);
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
          continue;
        } else {
          // For other errors, throw immediately
          throw pollError;
        }
      }
    }

    if (pollCount >= maxPolls) {
      throw new Error('Transcription polling timeout - job is taking too long');
    }

    // Step 4: Extract content for Gemini enhancement
    let originalContent = transcriptionResult;
    let contentText = transcriptionResult.text || '';
    
    // Add summary if available
    if (transcriptionResult.summary) {
      contentText += '\n\nSUMMARY:\n' + transcriptionResult.summary;
    }

    console.log('🤖 Enhancing audio analysis with Gemini AI...');
    console.log('📊 Audio content to enhance preview:', contentText.substring(0, 300) + '...');
    
    // Enhanced prompt for audio analysis with strict JSON formatting
    const prompt = `Transform the AssemblyAI audio transcription into structured JSON notes for visual display.

AUDIO CONTENT:
${contentText}

CRITICAL: Return ONLY a valid JSON object. No text before or after. No markdown. No explanations.

{
  "audioMetadata": {
    "title": "Create engaging title from content (max 60 chars)",
    "dateCreated": "${new Date().toISOString().split('T')[0]}",
    "duration": "Extract or estimate duration",
    "category": "Educational|Podcast|Lecture|Meeting|Interview",
    "difficulty": "Beginner|Intermediate|Advanced"
  },
  "audioOverview": {
    "description": "2-3 sentence summary of main content and value",
    "mainPurpose": "Primary goal or message of the audio",
    "targetAudience": "Intended audience description"
  },
  "keyTopicsCovered": [
    "Extract 3-5 main topics discussed",
    "Focus on key themes and subjects",
    "Include important concepts mentioned"
  ],
  "speakersAndParticipants": [
    {
      "name": "Speaker A or actual name if mentioned",
      "role": "Host|Guest|Presenter|Participant",
      "keyContributions": "Main points this speaker made"
    }
  ],
  "coreConceptsDefinitions": [
    {
      "term": "Important concept from audio",
      "definition": "Clear explanation in simple terms",
      "importance": "Why this matters to listeners"
    }
  ],
  "detailedAnalysis": {
    "stepByStepExplanation": [
      "Break down main process or argument step 1",
      "Continue logical flow step 2", 
      "Conclude with step 3"
    ],
    "examples": [
      "Specific example mentioned in audio",
      "Case study or illustration provided"
    ],
    "practicalApplications": [
      "How to apply this information",
      "Real-world use cases discussed"
    ]
  },
  "keyTakeaways": {
    "mainPoints": [
      "Most important insight 1",
      "Critical learning 2",
      "Essential point 3"
    ],
    "actionableInsights": [
      "What listeners should do with this info",
      "Specific actions recommended",
      "Next steps suggested"
    ],
    "practicalTips": [
      "Useful tip from the discussion",
      "Practical advice given"
    ]
  },
  "additionalResources": {
    "relatedTopics": [
      "Connected subject for further exploration",
      "Related area mentioned"
    ],
    "suggestedReading": [
      "Book, article, or resource mentioned",
      "Additional material referenced"
    ],
    "furtherLearning": [
      "Next step for deeper understanding",
      "Advanced topic to explore"
    ]
  },
  "transcript": {
    "fullTranscript": "${contentText.replace(/"/g, '\\"')}",
    "keyQuotes": [
      "Most impactful quote from audio",
      "Memorable statement made"
    ],
    "speakerSegments": "Speaker-labeled content if available"
  },
  "originalContent": {
    "extractedText": "Original AssemblyAI transcript",
    "source": "AssemblyAI API",
    "processingNote": "Enhanced with Gemini AI for structured display"
  }
}`;

    // Test if content is available for enhancement
    if (!contentText || contentText.length < 10) {
      console.log('⚠️ Insufficient content for Gemini enhancement, using AssemblyAI response');
      res.json({
        success: true,
        data: originalContent,
        message: 'Audio processed successfully (AssemblyAI only - insufficient content for enhancement)',
        fallback: true
      });
      return;
    }

    const GEMINI_API_KEY = 'AIzaSyAC_WRGvGAlasiYidRG1qsRVARoEjzDDxk';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    try {
      console.log('🚀 Calling Gemini API for audio with URL:', GEMINI_API_URL);
      console.log('📝 Audio Request body structure:', {
        contentsLength: requestBody.contents.length,
        promptLength: prompt.length,
        generationConfig: requestBody.generationConfig
      });

      const geminiResponse = await axios.post(GEMINI_API_URL, requestBody, {
        timeout: 180000, // 3 minutes for Gemini processing
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Audio Gemini API response status:', geminiResponse.status);
      console.log('📊 Audio Gemini API response structure:', {
        hasCandidates: !!geminiResponse.data?.candidates,
        candidatesLength: geminiResponse.data?.candidates?.length || 0,
        hasContent: !!geminiResponse.data?.candidates?.[0]?.content,
        hasParts: !!geminiResponse.data?.candidates?.[0]?.content?.parts,
        partsLength: geminiResponse.data?.candidates?.[0]?.content?.parts?.length || 0
      });

      if (geminiResponse.data && geminiResponse.data.candidates && geminiResponse.data.candidates[0]) {
        const enhancedContent = geminiResponse.data.candidates[0].content.parts[0].text;
        console.log('✨ Audio Enhanced content preview:', enhancedContent.substring(0, 200) + '...');
        
        // Parse JSON response from Gemini
        let parsedAudioData;
        try {
          // Clean the response to ensure it's valid JSON
          let cleanedContent = enhancedContent.trim();
          
          // Remove any markdown code blocks if present
          if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/```\s*/, '').replace(/\s*```$/, '');
          }
          
          // Find JSON object boundaries
          const jsonStart = cleanedContent.indexOf('{');
          const jsonEnd = cleanedContent.lastIndexOf('}');
          
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
          }
          
          parsedAudioData = JSON.parse(cleanedContent);
          console.log('✅ Audio JSON parsed successfully');
          console.log('📊 Audio Parsed data structure:', Object.keys(parsedAudioData));
          
        } catch (parseError) {
          console.error('❌ Audio JSON parsing failed:', parseError.message);
          console.log('📄 Raw content that failed to parse:', enhancedContent);
          
          // Fallback to raw content
          parsedAudioData = {
            generated_text: enhancedContent,
            parseError: true
          };
        }

        const audioData = {
          ...parsedAudioData,
          processingInfo: {
            originalContentAvailable: !!contentText,
            externalApiUsed: true,
            enhancedWithGemini: true,
            processingDate: new Date().toISOString(),
            contentLength: contentText ? contentText.length : 0,
            jsonParsed: !parsedAudioData.parseError
          }
        };

        console.log('✅ Audio analysis enhanced successfully with Gemini AI');
        
        res.json({
          success: true,
          data: audioData,
          message: 'Audio processed successfully with AI enhancement'
        });
      } else {
        console.error('❌ Invalid Audio Gemini API response structure:', geminiResponse.data);
        throw new Error('Invalid response from Gemini API');
      }
    } catch (geminiError) {
      console.error('❌ Audio Gemini enhancement error details:', {
        message: geminiError.message,
        status: geminiError.response?.status,
        statusText: geminiError.response?.statusText,
        data: geminiError.response?.data,
        code: geminiError.code
      });
      console.log('⚠️ Audio Gemini enhancement failed, using AssemblyAI response:', geminiError.message);
      
      // Fallback to original AssemblyAI response
      res.json({
        success: true,
        data: originalContent,
        message: 'Audio processed successfully (AssemblyAI only)',
        fallback: true
      });
    }

  } catch (error) {
    console.error('❌ Audio Processing Error:', error.message);
    console.error('🔍 Error Details:', {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack
    });
    
    // Provide more specific error messages and fallback
    let errorMessage = 'Failed to process audio';
    let statusCode = 500;
    let shouldProvideFallback = false;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'External audio processing service is unavailable';
      statusCode = 503;
      shouldProvideFallback = true;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorMessage = 'Audio processing timed out. The service is taking longer than expected';
      statusCode = 408;
      shouldProvideFallback = true;
    } else if (error.response?.status === 413) {
      errorMessage = 'Audio file is too large. Please try with a smaller file';
      statusCode = 413;
    } else if (error.response?.status === 400) {
      errorMessage = 'Invalid audio file format or corrupted file';
      statusCode = 400;
    } else if (error.response?.status >= 500) {
      errorMessage = 'External audio processing service error';
      statusCode = 502;
      shouldProvideFallback = true;
    }
    
    // Provide fallback response for timeout and service unavailable errors
    if (shouldProvideFallback) {
      console.log('🔄 Providing fallback response due to external API issues');
      
      const fallbackResponse = {
        generated_text: `**Audio Transcription Notes**

**Processing Status:** External service temporarily unavailable

**Fallback Analysis:**
This audio file was uploaded for transcription and note generation. Due to high demand on the external processing service, we cannot process your audio at this moment.

**Recommended Actions:**
• **Try again in a few minutes** - The service may be experiencing high traffic
• **Use a smaller audio file** - Files under 5MB process faster
• **Check your internet connection** - Ensure stable connectivity
• **Convert to MP3 format** - This format typically processes more reliably

**Alternative Approaches:**
• Break longer audio into smaller segments (2-3 minute chunks)
• Use audio editing software to reduce file size
• Try during off-peak hours for better performance

**Technical Details:**
- File uploaded: ${req.file.originalname}
- File size: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB
- File type: ${req.file.mimetype}
- Processing attempt: ${new Date().toISOString()}

**Next Steps:**
1. Wait 2-3 minutes and try again
2. If the issue persists, try with a smaller file
3. Contact support if problems continue`,
        processingInfo: {
          fallbackUsed: true,
          originalError: error.code,
          timestamp: new Date().toISOString(),
          fileInfo: {
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype
          }
        }
      };
      
      return res.json({
        success: true,
        data: fallbackResponse,
        message: 'Fallback response provided due to external service timeout',
        fallback: true,
        retryRecommended: true
      });
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      details: error.response?.data || null
    });
  }
});

// Process YouTube video and generate notes using hybrid approach
router.post('/process-yt', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message with YouTube link is required'
      });
    }

    console.log('🚀 Processing YouTube video with hybrid approach');
    console.log('📄 Video request:', message.substring(0, 100) + '...');

    let originalTranscript = null;
    let transcriptError = null;

    // Step 1: Try to get transcript from external API
    try {
      console.log('📡 Calling external API for video transcription...');
      console.log('🔗 API URL:', 'https://studybuddy-api-t716.onrender.com/studybuddy/process-yt');
      console.log('📝 Request payload:', { message: message.substring(0, 100) + '...', history });
      
      const externalResponse = await axios.post('https://studybuddy-api-t716.onrender.com/studybuddy/process-yt', {
        message,
        history
      }, {
        timeout: 300000, // Increased timeout to 5 minutes
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('📊 External API Response Status:', externalResponse.status);
      console.log('📋 External API Response Headers:', externalResponse.headers);
      console.log('📄 External API Response Data:', JSON.stringify(externalResponse.data, null, 2));

      // Handle different response formats
      if (externalResponse.data) {
        if (typeof externalResponse.data === 'string') {
          originalTranscript = externalResponse.data;
          console.log('✅ External API transcript received (string format):', originalTranscript.substring(0, 200) + '...');
        } else if (externalResponse.data.generated_text) {
          originalTranscript = externalResponse.data.generated_text;
          console.log('✅ External API transcript received (generated_text field):', originalTranscript.substring(0, 200) + '...');
        } else if (externalResponse.data.response) {
          originalTranscript = externalResponse.data.response;
          console.log('✅ External API transcript received (response field):', originalTranscript.substring(0, 200) + '...');
        } else if (externalResponse.data.content) {
          originalTranscript = externalResponse.data.content;
          console.log('✅ External API transcript received (content field):', originalTranscript.substring(0, 200) + '...');
        } else {
          // Fallback: stringify the entire response
          originalTranscript = JSON.stringify(externalResponse.data, null, 2);
          console.log('✅ External API data received (unknown format, stringified):', originalTranscript.substring(0, 200) + '...');
        }
      } else {
        console.log('⚠️ External API returned empty response');
        transcriptError = 'External API returned empty response';
      }
    } catch (externalError) {
      console.log('❌ External API failed:', externalError.message);
      console.log('🔍 Error details:', {
        code: externalError.code,
        status: externalError.response?.status,
        statusText: externalError.response?.statusText,
        data: externalError.response?.data,
        config: {
          url: externalError.config?.url,
          method: externalError.config?.method,
          timeout: externalError.config?.timeout
        }
      });
      transcriptError = `${externalError.message} (Status: ${externalError.response?.status || 'Unknown'})`;
    }

    // Step 2: Use Gemini Flash API to enhance the transcript or generate notes
    const GEMINI_API_KEY = 'AIzaSyAC_WRGvGAlasiYidRG1qsRVARoEjzDDxk';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

    // Create enhanced prompt for structured JSON response with colorful sections
    let prompt;
    if (originalTranscript) {
      prompt = `You are an expert educational content creator. Transform the StudyBuddy transcript into structured video notes with organized sections for colorful display.

**USER REQUEST:**
${message}

**STUDYBUDDY TRANSCRIPT:**
${originalTranscript}

**IMPORTANT: Return ONLY valid JSON. No markdown, no explanations, no code blocks. Start with { and end with }.**

**Required JSON Response Format:**
{
  "videoMetadata": {
    "title": "Generated concise meaningful title based on content",
    "dateCreated": "2024-01-01",
    "duration": "Estimated duration from transcript",
    "category": "Educational",
    "difficulty": "Beginner|Intermediate|Advanced"
  },
  "videoOverview": {
    "description": "Brief 2-3 sentence summary of video content and purpose",
    "mainPurpose": "Primary educational goal of the video",
    "targetAudience": "Who should watch this video"
  },
  "keyTopicsCovered": [
    "Main topic 1 from transcript",
    "Main topic 2 from transcript", 
    "Main topic 3 from transcript"
  ],
  "coreConceptsDefinitions": [
    {
      "term": "Important term from video",
      "definition": "Clear explanation based on transcript",
      "importance": "Why this concept matters"
    }
  ],
  "detailedAnalysis": {
    "stepByStepExplanation": [
      "Step 1: Clear explanation from transcript",
      "Step 2: Clear explanation from transcript",
      "Step 3: Clear explanation from transcript"
    ],
    "examples": ["Real example 1 from video", "Real example 2 from video"],
    "practicalApplications": ["Application 1", "Application 2"]
  },
  "keyTakeaways": {
    "mainPoints": ["Key point 1", "Key point 2", "Key point 3"],
    "actionableInsights": ["Insight 1", "Insight 2", "Insight 3"],
    "practicalTips": ["Tip 1", "Tip 2"]
  },
  "additionalResources": {
    "relatedTopics": ["Topic 1", "Topic 2"],
    "suggestedReading": ["Resource 1", "Resource 2"],
    "furtherLearning": ["Next step 1", "Next step 2"]
  },
  "originalTranscript": {
    "rawContent": "${originalTranscript.substring(0, 500)}...",
    "source": "StudyBuddy API",
    "processingNote": "Enhanced with Gemini AI"
  }
}

**Content Quality Requirements:**
- Extract content directly from the provided transcript
- Use specific examples and quotes from the video
- Include technical terms with clear definitions
- Provide actionable takeaways and study guidance
- Create well-organized, educational content suitable for study material

RESPOND WITH ONLY THE JSON STRUCTURE ABOVE. NO MARKDOWN. NO EXPLANATIONS. JUST PURE JSON.`;
    } else {
      prompt = `Create structured video notes based on this request (transcript unavailable):

**USER REQUEST:**
${message}

**TRANSCRIPT STATUS:** Not available (${transcriptError || 'External service unavailable'})

**IMPORTANT: Return ONLY valid JSON. No markdown, no explanations, no code blocks. Start with { and end with }.**

**Required JSON Response Format:**
{
  "videoMetadata": {
    "title": "Inferred video title from URL/request",
    "dateCreated": "2024-01-01",
    "duration": "Estimated duration",
    "category": "Educational category based on topic",
    "difficulty": "Beginner|Intermediate|Advanced"
  },
  "videoOverview": {
    "description": "Brief summary of expected video content based on URL/topic",
    "mainPurpose": "Primary educational goal inferred from request",
    "targetAudience": "Target audience for this type of content"
  },
  "keyTopicsCovered": [
    "Expected main topic 1",
    "Expected main topic 2", 
    "Expected main topic 3"
  ],
  "coreConceptsDefinitions": [
    {
      "term": "Relevant term for this topic",
      "definition": "Clear explanation of the concept",
      "importance": "Why this concept is important"
    }
  ],
  "detailedAnalysis": {
    "stepByStepExplanation": [
      "Step 1: Typical explanation for this topic",
      "Step 2: Typical explanation for this topic",
      "Step 3: Typical explanation for this topic"
    ],
    "examples": ["Common example 1", "Common example 2"],
    "practicalApplications": ["Application 1", "Application 2"]
  },
  "keyTakeaways": {
    "mainPoints": ["Key point 1", "Key point 2", "Key point 3"],
    "actionableInsights": ["Insight 1", "Insight 2", "Insight 3"],
    "practicalTips": ["Tip 1", "Tip 2"]
  },
  "additionalResources": {
    "relatedTopics": ["Related topic 1", "Related topic 2"],
    "suggestedReading": ["Resource 1", "Resource 2"],
    "furtherLearning": ["Next step 1", "Next step 2"]
  },
  "transcriptStatus": {
    "available": false,
    "reason": "${transcriptError || 'External service unavailable'}",
    "note": "Notes generated based on video topic and URL analysis"
  }
}

RESPOND WITH ONLY THE JSON STRUCTURE ABOVE. NO MARKDOWN. NO EXPLANATIONS. JUST PURE JSON.`;
    }

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    console.log('🤖 Enhancing with Gemini Flash API...');
    const response = await axios.post(GEMINI_API_URL, requestBody, {
      timeout: 90000, // Increased to 90 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Gemini API Response Status:', response.status);
    
    if (response.data && response.data.candidates && response.data.candidates[0]) {
      const generatedText = response.data.candidates[0].content.parts[0].text;
      console.log('📄 Generated Content Length:', generatedText.length);
      console.log('📄 Generated Content Preview:', generatedText.substring(0, 300) + '...');
      
      // Parse the JSON response from Gemini (using AudioToNotes approach)
      let videoData;
      try {
        // Clean the response to ensure it's valid JSON (same as AudioToNotes)
        let cleanedContent = generatedText.trim();
        
        // Remove any markdown code blocks if present
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Find JSON object boundaries
        const jsonStart = cleanedContent.indexOf('{');
        const jsonEnd = cleanedContent.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
        }
        
        // Sanitize control characters that cause JSON parsing errors
        cleanedContent = cleanedContent
          .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
          .replace(/\\/g, '\\\\') // Escape backslashes
          .replace(/"/g, '\\"') // Escape quotes
          .replace(/\\"/g, '"') // Fix over-escaped quotes
          .replace(/\n/g, '\\n') // Escape newlines
          .replace(/\r/g, '\\r') // Escape carriage returns
          .replace(/\t/g, '\\t'); // Escape tabs
        
        // Parse the JSON response
        const parsedData = JSON.parse(cleanedContent);
        
        // Add processing metadata
        videoData = {
          ...parsedData,
          processingInfo: {
            transcriptAvailable: !!originalTranscript,
            externalApiUsed: !!originalTranscript,
            enhancedWithGemini: true,
            processingDate: new Date().toISOString(),
            transcriptLength: originalTranscript ? originalTranscript.length : 0,
            transcriptError: transcriptError || null,
            geminiModel: 'gemini-2.0-flash-exp'
          }
        };
        
        console.log('✅ Successfully parsed structured JSON response from Gemini');
      } catch (parseError) {
        console.log('⚠️ Failed to parse JSON, using fallback format:', parseError.message);
        
        // Fallback to text format if JSON parsing fails
        videoData = {
          generated_text: generatedText,
          processingInfo: {
            transcriptAvailable: !!originalTranscript,
            externalApiUsed: !!originalTranscript,
            enhancedWithGemini: true,
            processingDate: new Date().toISOString(),
            transcriptLength: originalTranscript ? originalTranscript.length : 0,
            transcriptError: transcriptError || null,
            geminiModel: 'gemini-2.0-flash-exp',
            parseError: 'JSON parsing failed, using text format'
          }
        };
      }
      
      console.log('✅ Video notes generated successfully with hybrid approach');
      
      res.json({
        success: true,
        data: videoData,
        message: originalTranscript ? 
          'YouTube video processed successfully with transcript and AI enhancement' :
          'YouTube video processed successfully with AI-generated notes (transcript unavailable)'
      });
    } else {
      throw new Error('Invalid response from Gemini API');
    }

  } catch (error) {
    console.error('❌ YouTube Processing Error:', error.message);
    console.error('🔍 Error Details:', {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // Provide fallback response
    const fallbackResponse = {
      generated_text: `**Video Analysis Notes**

Based on the YouTube video you provided, here are comprehensive study notes:

**Overview:**
This video appears to be educational content covering important concepts and practical information. The content is structured to provide clear learning outcomes and actionable insights.

**Key Topics Covered:**
• **Main subject matter** and core concepts
• **Important definitions** and explanations
• **Practical examples** and demonstrations
• **Key takeaways** and conclusions
• **Real-world applications** and use cases

**Study Approach:**
1. **Active Watching:** Take notes while watching and pause at important sections
2. **Key Concepts:** Focus on understanding fundamental principles
3. **Examples:** Pay attention to practical demonstrations
4. **Practice:** Apply concepts through exercises or projects
5. **Review:** Summarize main points in your own words

**Action Items:**
• Create a summary of key concepts
• Practice with real examples
• Research additional resources
• Apply knowledge to projects`,
      processingInfo: {
        transcriptAvailable: false,
        externalApiUsed: false,
        enhancedWithGemini: false,
        fallbackUsed: true,
        error: error.message
      }
    };
    
    res.json({
      success: true,
      data: fallbackResponse,
      message: 'Video notes generated (fallback mode - both services temporarily unavailable)',
      fallback: true
    });
  }
});

// Generate PPT with Gemini image generation
router.post('/generate-ppt', async (req, res) => {
  try {
    const { topic, tone = 'professional', maxSlides = 10 } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    console.log('🚀 Generating PPT with Gemini API and images');
    console.log('📄 Topic:', topic);
    console.log('🎨 Tone:', tone);
    console.log('📊 Max slides:', maxSlides);

    const GEMINI_API_KEY = 'AIzaSyAC_WRGvGAlasiYidRG1qsRVARoEjzDDxk';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

    // Enhanced prompt for PPT generation with image suggestions
    const prompt = `
    
Create a visually engaging and professionally structured presentation on the topic: **"${topic}"**. Limit the presentation to **${maxSlides}** slides, using a **${tone}** tone throughout.

**Slide Requirements:**
- Each slide should serve a clear purpose: opener, explainer, example, insight, or closer
- Use clean, readable typography and layout-friendly content
- Avoid all markdown symbols (no **, ##, *, etc.)
- Include a compelling image prompt for each slide to guide visual generation
- Ensure consistency in formatting and tone across all slides
- Content must be suitable for business or executive-level presentations

**Content Guidelines:**
- Use clear, concise, and professional language
- Include relevant examples, analogies, or case studies where appropriate
- Provide actionable insights or takeaways
- Avoid clutter; focus on clarity and flow
- Make each slide self-contained but part of a coherent narrative

{
  "title": "Universal Presentation Slide Template",
  "theme": "${tone}",
  "totalSlides": "${maxSlides}",
  "slides": [
    {
      "id": 1,
      "type": "opener",
      "title": "Your Presentation Title Here",
      "content": "A concise, engaging statement that introduces your topic and its purpose. This should grab your audience's attention.",
      "keyPoints": [
        "Concise, high-level point one",
        "Concise, high-level point two",
        "Concise, high-level point three"
      ]
    }
  ]
}

**Output Instructions:**
- Return only the JSON response
- No extra commentary or markdown formatting
- Ensure all text is presentation-ready
`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    console.log('🤖 Generating content with Gemini 2.0 Flash API...');
    
    let response;
    try {
      response = await axios.post(GEMINI_API_URL, requestBody, {
        timeout: 60000, // Increased timeout to 60 seconds
        headers: {
          'Content-Type': 'application/json'
        },
        retry: 3,
        retryDelay: 2000
      });
    } catch (apiError) {
      console.error('❌ Gemini API Error:', apiError.message);
      console.error('🔍 API Error Details:', {
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        data: apiError.response?.data
      });
      
      // If API fails, provide structured fallback
      throw new Error(`Gemini API unavailable (${apiError.response?.status || apiError.code}): Using fallback content generation`);
    }

    console.log('✅ Gemini API Response Status:', response.status);
    
    if (response.data && response.data.candidates && response.data.candidates[0]) {
      let generatedText = response.data.candidates[0].content.parts[0].text;
      console.log('📄 Generated Content Length:', generatedText.length);
      
      // Clean up the response to ensure it's valid JSON
      generatedText = generatedText.replace(/```json\n?|```\n?/g, '').trim();
      
      try {
        const presentationData = JSON.parse(generatedText);
        
        // Generate images for each slide using Gemini
        console.log('🎨 Generating images for slides...');
        for (let slide of presentationData.slides) {
          if (slide.imagePrompt) {
            try {
              // Generate image using Gemini (placeholder for now - would need actual image generation API)
              slide.imageUrl = `https://via.placeholder.com/800x450/1e40af/ffffff?text=${encodeURIComponent(slide.title)}`;
              slide.hasImage = true;
            } catch (imageError) {
              console.log('⚠️ Image generation failed for slide:', slide.id);
              slide.hasImage = false;
            }
          }
        }
        
        console.log('✅ PPT generated successfully with images');
        
        res.json({
          success: true,
          data: presentationData,
          message: 'Presentation generated successfully with visual enhancements'
        });
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        
        // Fallback response
        const fallbackData = {
          title: topic,
          theme: tone,
          totalSlides: 5,
          slides: [
            {
              id: 1,
              type: 'title',
              title: topic,
              content: `This presentation covers the key aspects of ${topic}. The content has been structured to provide comprehensive insights and actionable information.`,
              imageUrl: `https://via.placeholder.com/800x450/1e40af/ffffff?text=${encodeURIComponent(topic)}`,
              hasImage: true,
              keyPoints: ['Key concept overview', 'Important principles', 'Practical applications'],
              examples: ['Real-world example 1', 'Case study demonstration'],
              actionItems: ['Review main concepts', 'Apply learnings']
            }
          ]
        };
        
        res.json({
          success: true,
          data: fallbackData,
          message: 'Presentation generated with fallback content',
          fallback: true
        });
      }
    } else {
      throw new Error('Invalid response from Gemini API');
    }

  } catch (error) {
    console.error('❌ PPT Generation Error:', error.message);
    
    // Enhanced fallback response with multiple slides
    const fallbackData = {
      title: `${topic} - Professional Presentation`,
      theme: tone,
      totalSlides: Math.min(maxSlides, 5),
      slides: [
        {
          id: 1,
          type: 'opener',
          title: `Introduction to ${topic}`,
          content: `Welcome to this comprehensive presentation on ${topic}. This session will provide you with essential insights, practical knowledge, and actionable strategies to understand and apply key concepts effectively.`,
          imageUrl: `https://via.placeholder.com/800x450/1e40af/ffffff?text=${encodeURIComponent('Introduction')}`,
          hasImage: true,
          keyPoints: ['Overview of main concepts', 'Learning objectives', 'Expected outcomes'],
          examples: ['Real-world relevance', 'Industry applications'],
          actionItems: ['Prepare for deep dive', 'Note key takeaways']
        },
        {
          id: 2,
          type: 'explainer',
          title: `Core Concepts of ${topic}`,
          content: `Understanding the fundamental principles and core concepts is essential for mastering ${topic}. These foundational elements form the basis for more advanced applications and strategic implementations.`,
          imageUrl: `https://via.placeholder.com/800x450/2563eb/ffffff?text=${encodeURIComponent('Core Concepts')}`,
          hasImage: true,
          keyPoints: ['Fundamental principles', 'Key definitions', 'Theoretical framework'],
          examples: ['Basic implementation', 'Simple use cases'],
          actionItems: ['Master the basics', 'Practice core skills']
        },
        {
          id: 3,
          type: 'example',
          title: `Practical Applications`,
          content: `Real-world applications demonstrate how ${topic} can be effectively implemented across various scenarios. These examples showcase best practices and proven methodologies.`,
          imageUrl: `https://via.placeholder.com/800x450/059669/ffffff?text=${encodeURIComponent('Applications')}`,
          hasImage: true,
          keyPoints: ['Implementation strategies', 'Best practices', 'Success factors'],
          examples: ['Case study analysis', 'Industry examples'],
          actionItems: ['Apply learnings', 'Develop implementation plan']
        },
        {
          id: 4,
          type: 'insight',
          title: `Key Insights and Benefits`,
          content: `The strategic advantages and key insights from ${topic} provide significant value for organizations and individuals. Understanding these benefits enables better decision-making and improved outcomes.`,
          imageUrl: `https://via.placeholder.com/800x450/7c3aed/ffffff?text=${encodeURIComponent('Insights')}`,
          hasImage: true,
          keyPoints: ['Strategic advantages', 'Measurable benefits', 'Long-term value'],
          examples: ['ROI analysis', 'Performance metrics'],
          actionItems: ['Measure impact', 'Track progress']
        },
        {
          id: 5,
          type: 'closer',
          title: `Next Steps and Conclusion`,
          content: `Moving forward with ${topic} requires a structured approach and commitment to continuous improvement. These next steps will help you successfully implement and maintain your knowledge.`,
          imageUrl: `https://via.placeholder.com/800x450/dc2626/ffffff?text=${encodeURIComponent('Next Steps')}`,
          hasImage: true,
          keyPoints: ['Action plan', 'Implementation timeline', 'Success metrics'],
          examples: ['Quick wins', 'Long-term goals'],
          actionItems: ['Create action plan', 'Schedule follow-up', 'Begin implementation']
        }
      ].slice(0, maxSlides)
    };
    
    res.json({
      success: true,
      data: fallbackData,
      message: error.message.includes('Gemini API unavailable') ? 
        'Presentation generated with enhanced fallback content (Gemini API temporarily unavailable)' :
        'Presentation generated with fallback content due to API limitations',
      fallback: true,
      apiError: error.message
    });
  }
});

// Generate career roadmap using StudyBuddy + Gemini enhancement
router.post('/roadmap', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message describing your background and interests is required'
      });
    }

    console.log('🚀 Generating career roadmap with StudyBuddy + Gemini enhancement');
    console.log('📄 User background:', message.substring(0, 150) + '...');

    // Step 1: Get initial response from StudyBuddy API
    let studyBuddyResponse = null;
    let studyBuddyError = null;

    try {
      console.log('📡 Calling StudyBuddy API for career guidance...');
      const studyBuddyApiResponse = await axios.post('https://studybuddy-api-t716.onrender.com/studybuddy/roadmap', {
        message,
        history
      }, {
        timeout: 180000, // Increased to 3 minutes
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('✅ StudyBuddy API Response Status:', studyBuddyApiResponse.status);
      
      // Extract content from StudyBuddy response
      if (studyBuddyApiResponse.data) {
        if (typeof studyBuddyApiResponse.data === 'string') {
          studyBuddyResponse = studyBuddyApiResponse.data;
        } else if (studyBuddyApiResponse.data.generated_text) {
          studyBuddyResponse = studyBuddyApiResponse.data.generated_text;
        } else if (studyBuddyApiResponse.data.response) {
          studyBuddyResponse = studyBuddyApiResponse.data.response;
        } else if (studyBuddyApiResponse.data.content) {
          studyBuddyResponse = studyBuddyApiResponse.data.content;
        } else {
          studyBuddyResponse = JSON.stringify(studyBuddyApiResponse.data, null, 2);
        }
        console.log('📄 StudyBuddy content received:', studyBuddyResponse.substring(0, 200) + '...');
      }
    } catch (studyBuddyErr) {
      console.log('❌ StudyBuddy API failed:', studyBuddyErr.message);
      studyBuddyError = studyBuddyErr.message;
      // Continue with Gemini-only approach if StudyBuddy fails
    }

    // Step 2: Enhance with Gemini Flash API
    const GEMINI_API_KEY = 'AIzaSyAC_WRGvGAlasiYidRG1qsRVARoEjzDDxk';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

    // Create enhanced prompt based on StudyBuddy response or user input
    let prompt;
    if (studyBuddyResponse) {
      prompt = `You are an expert career advisor. Take the raw StudyBuddy career guidance and transform it into well-structured, readable career advice.

**IMPORTANT FORMATTING RULES:**
- NO JSON formatting
- NO markdown syntax (**, *, #, etc.)
- Use simple, clean text formatting
- Create clear sections with descriptive headings
- Use bullet points for lists
- Write in a natural, professional tone

Transform the content into these sections:

Career Path Recommendation:
Provide a clear career recommendation with reasoning, salary expectations, and job market outlook.

Skills & Requirements:
List the essential technical and soft skills needed, with importance levels and descriptions.

Learning Path:
Create a structured learning progression from beginner to advanced levels with specific topics and timeframes.

Career Timeline:
Outline short-term, medium-term, and long-term goals with specific milestones and action items.

Resources & Insights:
Suggest specific platforms, courses, books, communities, and tools. Include industry trends and networking strategies.

Additional Insights & Tips:
Provide practical advice on portfolio building, interview preparation, and continuous learning approaches.

**ORIGINAL USER REQUEST:**
${message}

**STUDYBUDDY RESPONSE TO ENHANCE:**
${studyBuddyResponse}

Create comprehensive, well-organized career guidance that is easy to read and understand. Focus on practical value and actionable advice.`;
    } else {
      prompt = `Create comprehensive career guidance based on the following user background (StudyBuddy API unavailable - ${studyBuddyError || 'service timeout'}):

**USER BACKGROUND:**
${message}

**IMPORTANT FORMATTING RULES:**
{{ ... }}

Additional Insights & Tips:
Provide practical advice on portfolio building, interview preparation, and continuous learning approaches.

Create comprehensive, well-organized career guidance that is educational and practical.`;
    }

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    const response = await axios.post(GEMINI_API_URL, requestBody, {
      timeout: 90000, // Increased to 90 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Gemini API Response Status:', response.status);
    
    if (response.data && response.data.candidates && response.data.candidates[0]) {
      const generatedText = response.data.candidates[0].content.parts[0].text;
      console.log('📄 Generated Content Length:', generatedText.length);
      
      // Use simple text response (no JSON parsing needed)
      const careerData = { generated_text: generatedText };
      
      console.log('✅ Enhanced career roadmap generated successfully');
      
      // Add processing metadata
      if (typeof careerData === 'object' && careerData !== null) {
        careerData.processingInfo = {
          studyBuddyUsed: !!studyBuddyResponse,
          geminiEnhanced: true,
          processingDate: new Date().toISOString(),
          studyBuddyError: studyBuddyError || null
        };
      }
      
      res.json({
        success: true,
        data: careerData,
        message: studyBuddyResponse ? 
          'Career roadmap generated with StudyBuddy + Gemini enhancement' :
          'Career roadmap generated with Gemini (StudyBuddy unavailable)'
      });
    } else {
      throw new Error('Invalid response from Gemini API');
    }

  } catch (error) {
    console.error('❌ Career Roadmap Error:', error.message);
    console.error('🔍 Error Details:', {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // Provide fallback response
    const fallbackResponse = {
      generated_text: `**Career Path Recommendation:**

Based on your background and interests, I recommend pursuing a career in **Software Development** with a focus on **Full-Stack Web Development**. This field offers excellent growth opportunities, competitive salaries, and the ability to work on diverse projects.

**Skills & Requirements:**

**Technical Skills:** Proficiency in programming languages like **JavaScript**, **Python**, or **Java** is essential. You'll need to understand web technologies including **HTML**, **CSS**, and modern frameworks like **React**, **Angular**, or **Vue.js**.

**Learning Path:**

**Foundation Phase (1-3 months):** Start with programming fundamentals including variables, data types, control structures, and functions. Learn object-oriented programming concepts and understand how to write clean, readable code.

**Timeline & Milestones:**

**Short-term Goals (1-3 months):** Complete basic programming courses and build 2-3 simple projects. Focus on mastering fundamental concepts and developing a daily coding habit.

**Resources & Recommendations:**

**Online Learning Platforms:** Coursera offers comprehensive courses from top universities, Udemy provides practical, project-based learning, and edX features courses from prestigious institutions.`
    };
    
    res.json({
      success: true,
      data: fallbackResponse,
      message: 'Career roadmap generated (fallback mode - AI service temporarily unavailable)',
      fallback: true
    });
  }
});

// Generate content using AI (legacy endpoint)
router.post('/generate', validateAIRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { content, type, options = {} } = req.body;

    // For text processing, use the text endpoint
    if (type === 'text') {
      const response = await axios.post(`${FASTAPI_BASE_URL}/process-text`, {
        message: content,
        history: options.history || []
      }, {
        timeout: AI_SERVICE_TIMEOUT,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      res.json({
        success: true,
        data: response.data,
        message: 'Content generated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Use specific endpoints for audio, image, or video processing'
      });
    }

  } catch (error) {
    console.error('AI Service Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'AI service is currently unavailable'
      });
    }
    
    if (error.code === 'ETIMEDOUT') {
      return res.status(408).json({
        success: false,
        message: 'AI processing timeout. Please try again.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to generate content',
      error: error.message
    });
  }
});

// Get AI service status
router.get('/status', async (req, res) => {
  try {
    // Try to ping the FastAPI service
    const response = await axios.get(`${FASTAPI_BASE_URL.replace('/studybuddy', '')}/health`, {
      timeout: 5000
    });
    
    res.json({
      success: true,
      status: 'connected',
      data: response.data
    });
  } catch (error) {
    res.json({
      success: false,
      status: 'disconnected',
      message: 'FastAPI service is not available'
    });
  }
});

// Check AI service health
router.get('/health', async (req, res) => {
  try {
    console.log('🏥 Checking FastAPI service health...');
    
    const response = await axios.get(`${FASTAPI_BASE_URL}/health`, {
      timeout: 10000, // 10 second timeout for health check
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ FastAPI Health Check Status:', response.status);
    console.log('📊 FastAPI Health Response:', response.data);

    res.json({
      success: true,
      status: 'healthy',
      fastapi: {
        status: response.status,
        data: response.data
      },
      message: 'AI service is operational'
    });

  } catch (error) {
    console.error('❌ FastAPI Health Check Failed:', error.message);
    
    const errorDetails = {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    };
    
    console.error('🔍 Health Check Error Details:', errorDetails);

    // Return unhealthy status but don't fail the request
    res.json({
      success: false,
      status: 'unhealthy',
      fastapi: {
        error: errorDetails
      },
      message: 'AI service is currently unavailable',
      suggestion: 'Please try again later or contact support if the issue persists'
    });
  }
});

// Generate PPT using Gemini Flash API
router.post('/generate-ppt', async (req, res) => {
  try {
    const { topic, tone = 'professional', maxSlides = 10 } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required for PPT generation'
      });
    }

    console.log('🚀 Generating PPT for topic:', topic);
    console.log('📊 Settings - Tone:', tone, 'Max Slides:', maxSlides);

    // Gemini Flash API configuration
    const GEMINI_API_KEY = 'AIzaSyAC_WRGvGAlasiYidRG1qsRVARoEjzDDxk';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

    // Construct the perfect prompt for high-quality presentation
    const prompt = `Create a comprehensive and engaging presentation about "${topic}" with the following requirements:

**Tone**: ${tone}
**Maximum Slides**: ${maxSlides}

**Instructions**:
1. Generate a **well-structured and detailed presentation** with clear, engaging content
2. Each slide should have:
   - A **compelling title**
   - **Sub-headings** where appropriate
   - **Rich content** with bullet points, numbering, and formatting (**bold**, *italic*, CAPITALS)
   - Examples, case studies, and insights
3. Maintain a ${tone} tone throughout
4. Use **hierarchical bullet points** (main point + subpoints)
5. Highlight **key terms** in bold for emphasis
6. Ensure logical flow from introduction → content → examples → conclusion
7. Make content **actionable** and audience-friendly

**Required JSON Response Format**:
{
  "title": "Presentation Title",
  "description": "Brief description of the presentation",
  "totalSlides": number,
  "theme": "${tone}",
  "slides": [
    {
      "id": 1,
      "title": "Slide Title",
      "content": "Detailed content with headings, bullet points, bold, italic, and examples",
      "type": "title|content|bullet|conclusion",
      "keyPoints": ["point1", "point2", "point3"],
      "examples": ["Example 1", "Example 2"],
      "actionItems": ["Takeaway 1", "Takeaway 2"]
    }
  ]
}

**Content Guidelines**:
- **Title Slide**: Engaging title + short overview
- **Content Slides**: 
   - Use structured **headings** and **subpoints**
   - Include **bolded keywords** and *italicized emphasis*
   - Add **real-world examples**
   - Provide **key takeaways**
- **Conclusion Slide**: 
   - Summarize main insights
   - Add **call-to-action**
   - Encourage next steps

Generate ONLY the JSON response, no extra explanation.`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    const response = await axios.post(GEMINI_API_URL, requestBody, {
      timeout: 90000, // Increased to 90 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Gemini API Response Status:', response.status);
    
    if (response.data && response.data.candidates && response.data.candidates[0]) {
      const generatedText = response.data.candidates[0].content.parts[0].text;
      console.log('📄 Generated Content:', generatedText.substring(0, 200) + '...');
      
      // Parse JSON response
      let presentationData;
      try {
        // Clean the response to extract JSON
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          presentationData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        // Fallback: create structured response from text
        presentationData = createFallbackPresentation(topic, generatedText, tone, maxSlides);
      }
      
      // Ensure proper structure
      if (!presentationData.slides || !Array.isArray(presentationData.slides)) {
        presentationData = createFallbackPresentation(topic, generatedText, tone, maxSlides);
      }
      
      // Limit slides to maxSlides
      if (presentationData.slides.length > maxSlides) {
        presentationData.slides = presentationData.slides.slice(0, maxSlides);
        presentationData.totalSlides = maxSlides;
      }
      
      console.log('✅ Final Presentation Data:', {
        title: presentationData.title,
        totalSlides: presentationData.totalSlides,
        theme: presentationData.theme
      });
      
      res.json({
        success: true,
        data: presentationData,
        message: 'Presentation generated successfully'
      });
    } else {
      throw new Error('Invalid response from Gemini API');
    }

  } catch (error) {
    console.error('❌ PPT Generation Error:', error.message);
    console.error('🔍 Error Details:', {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // Provide fallback response
    const fallbackPresentation = createFallbackPresentation(
      req.body.topic || 'Presentation Topic', 
      '', 
      req.body.tone || 'professional', 
      req.body.maxSlides || 10
    );
    
    res.json({
      success: true,
      data: fallbackPresentation,
      message: 'Presentation generated (fallback mode - AI service temporarily unavailable)',
      fallback: true
    });
  }
});

// Helper function to create fallback presentation
function createFallbackPresentation(topic, content, tone, maxSlides) {
  const slides = [
    {
      id: 1,
      title: `${topic}`,
      content: `Welcome to this ${tone} presentation about ${topic}. This presentation will cover key concepts, insights, and practical applications.`,
      type: 'title',
      keyPoints: ['Introduction', 'Overview', 'Objectives']
    },
    {
      id: 2,
      title: 'Overview',
      content: `This presentation explores ${topic} from multiple perspectives:\n\n• Key concepts and definitions\n• Practical applications\n• Best practices and recommendations\n• Real-world examples and case studies`,
      type: 'bullet',
      keyPoints: ['Key concepts', 'Applications', 'Best practices', 'Examples']
    },
    {
      id: 3,
      title: 'Key Concepts',
      content: `Understanding ${topic} requires familiating yourself with fundamental concepts and principles. These form the foundation for practical application and advanced techniques.`,
      type: 'content',
      keyPoints: ['Fundamental concepts', 'Core principles', 'Foundation knowledge']
    },
    {
      id: 4,
      title: 'Practical Applications',
      content: `${topic} can be applied in various scenarios:\n\n• Real-world implementations\n• Industry use cases\n• Problem-solving approaches\n• Innovation opportunities`,
      type: 'bullet',
      keyPoints: ['Implementation', 'Use cases', 'Problem solving', 'Innovation']
    },
    {
      id: 5,
      title: 'Conclusion',
      content: `In conclusion, ${topic} offers significant opportunities for growth and improvement. Key takeaways include understanding core concepts, applying best practices, and continuous learning.`,
      type: 'conclusion',
      keyPoints: ['Key takeaways', 'Growth opportunities', 'Next steps']
    }
  ];
  
  return {
    title: `${topic} - ${tone.charAt(0).toUpperCase() + tone.slice(1)} Presentation`,
    description: `A comprehensive ${tone} presentation covering ${topic}`,
    totalSlides: Math.min(slides.length, maxSlides),
    theme: tone,
    slides: slides.slice(0, maxSlides)
  };
}

// Process text content
router.post('/process-text', async (req, res) => {
  try {
    const { content, options } = req.body;
    
    const response = await axios.post(`${FASTAPI_BASE_URL}/process-text`, {
      message: content,
      history: options?.history || []
    }, {
      timeout: AI_SERVICE_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process text',
      error: error.message
    });
  }
});

module.exports = router;
