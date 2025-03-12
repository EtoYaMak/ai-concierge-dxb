# Firebase Voice Chat Integration

This document provides instructions for setting up the Firebase Voice Chat integration for the Dubai Concierge application.

## Overview

The Firebase Voice Chat integration allows users to interact with the AI assistant using voice instead of text. It uses:

1. **Web Speech API** for speech recognition
2. **Firebase Realtime Database** for real-time communication
3. **OpenAI API** for generating responses and text-to-speech

## Setup Instructions

### 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Enable the Realtime Database
   - Go to "Build" > "Realtime Database"
   - Click "Create Database"
   - Start in test mode (you can adjust security rules later)

### 2. Get Firebase Configuration

#### For Server-Side (Firebase Admin SDK)

1. Go to Project Settings > Service Accounts
2. Click "Generate new private key"
3. Save the JSON file securely
4. Extract the following values from the JSON file:
   - `project_id`
   - `client_email`
   - `private_key`

#### For Client-Side (Firebase Web SDK)

1. Go to Project Settings > General
2. Scroll down to "Your apps" section
3. Click the web icon (</>) to add a web app
4. Register your app with a nickname
5. Copy the Firebase configuration object

### 3. Set Environment Variables

Create a `.env.local` file in the root of your project with the following variables (use the `.env.local.example` as a template):

```
# Firebase Admin SDK Configuration (Server-side)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Private Key Here\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com

# Firebase Client Configuration (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# API Key for Firebase Listener
FIREBASE_LISTENER_API_KEY=your-custom-api-key-for-firebase-listener

# OpenAI API Key
OPENAI_API_KEY=your-openai-api-key
```

### 4. Initialize the Firebase Listener

The Firebase listener needs to be initialized to process voice transcriptions. You can do this in two ways:

#### Option 1: Initialize on Server Start

Add the following code to your server startup script:

```javascript
// Initialize Firebase listener on server start
fetch("https://your-domain.com/api/init-firebase", {
  headers: {
    "x-api-key": process.env.FIREBASE_LISTENER_API_KEY,
  },
})
  .then((response) => response.json())
  .then((data) => console.log("Firebase listener initialized:", data))
  .catch((error) =>
    console.error("Error initializing Firebase listener:", error)
  );
```

#### Option 2: Initialize via API Call

Make a GET request to `/api/init-firebase` with the `x-api-key` header set to your `FIREBASE_LISTENER_API_KEY`.

### 5. Test the Voice Chat

1. Navigate to `/voice-chat` in your application
2. Enter a user ID and click "Start Voice Chat"
3. Allow microphone access when prompted
4. Speak your question or request
5. The system will process your speech and send it to the AI
6. The AI will respond with text and audio

## Architecture

### Client-Side Components

- **VoiceChat.tsx**: The main component for voice chat UI and speech recognition
- **firebase-client.ts**: Client-side Firebase configuration and helper functions

### Server-Side Components

- **firebase.ts**: Server-side Firebase configuration and helper functions
- **firebase-listener.ts**: Listens for new transcriptions and processes them
- **init-firebase/route.ts**: API route to initialize the Firebase listener

### Data Flow

1. User speaks into the microphone
2. Web Speech API converts speech to text
3. Text is sent to Firebase Realtime Database
4. Firebase listener detects the new transcription
5. Server processes the transcription using the AI
6. AI response is sent back to Firebase
7. Client receives the response and plays it as audio

## Troubleshooting

### Speech Recognition Not Working

- Ensure you're using a supported browser (Chrome, Edge, Safari)
- Check that microphone permissions are granted
- Verify that the Web Speech API is available in your browser

### Firebase Connection Issues

- Check your Firebase configuration in the `.env.local` file
- Ensure the Firebase Realtime Database is enabled
- Verify that your Firebase security rules allow read/write access

### AI Response Issues

- Check your OpenAI API key
- Verify that the Firebase listener is initialized
- Check the server logs for any errors

## Security Considerations

- The current implementation uses Firebase in test mode, which allows anyone to read/write data
- For production, update the Firebase security rules to restrict access
- Consider adding authentication to the voice chat feature
- Secure the Firebase listener API with a strong API key
