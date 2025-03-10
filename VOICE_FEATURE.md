# Voice Chat Feature

This document provides instructions on how to use the new voice chat feature in the Concierge AI application.

## Overview

The voice chat feature allows you to have a natural, continuous conversation with the AI assistant, similar to a phone call. You can speak naturally, and the AI will respond with both text and voice in real-time, creating a truly immersive conversation experience.

## How to Use

1. **Accessing Voice Chat**:

   - Click the microphone icon in the chat input box to open the full-screen voice chat interface.

2. **Starting a Conversation**:

   - In the voice chat screen, click the green phone button to start the conversation.
   - The system will request access to your microphone (if not already granted).
   - Once connected, you'll see an audio visualizer showing your voice input.

3. **Speaking with the Assistant**:

   - Simply speak naturally as if having a phone conversation.
   - Your words will be transcribed in real-time at the bottom of the screen.
   - When you pause, the system will automatically process what you've said.

4. **Receiving Responses**:

   - The AI's response will appear in the conversation history.
   - If audio is enabled (default setting), the response will also be spoken aloud.
   - While one exchange is being processed, you can continue the conversation without waiting.

5. **Audio Controls**:

   - Click the speaker icon in the top-right corner to toggle audio responses on/off.

6. **Ending the Conversation**:
   - Click the red phone button to end the conversation.
   - Click the X in the top-right corner to close the voice chat interface and return to the text chat.

## Conversation Flow

Unlike traditional voice interfaces where you must press a button to start and stop each recording, this interface maintains an open connection, allowing for more natural back-and-forth conversation:

1. You speak → Your speech is transcribed in real-time
2. When you pause → AI processes your input
3. AI responds with text and voice
4. You can immediately respond without pressing any buttons
5. The conversation continues this way until you end it

## Technical Requirements

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- Microphone access (you'll be prompted to allow this)
- Speakers or headphones for audio responses
- Stable internet connection for real-time streaming
- OpenAI API key (configured in the application)

## Privacy Note

Audio data is processed using OpenAI's Realtime WebSocket API. Your voice is streamed securely in real-time for transcription and speech synthesis. Audio is not stored permanently and is only used for the purpose of providing the voice chat functionality.

## Troubleshooting

If you encounter issues with the voice chat feature:

1. **Microphone not working**:

   - Check if your browser has permission to access your microphone
   - Make sure your microphone is not muted or disabled in your system settings

2. **No audio response**:

   - Check if the audio is enabled (speaker icon should not have a cross)
   - Verify your device's volume is turned up

3. **Speech recognition issues**:

   - Try speaking more clearly and slowly
   - Reduce background noise if possible
   - Ensure you have a stable internet connection

4. **Delay in responses**:

   - This can occur with slower internet connections
   - Try moving closer to your router or switching to a more stable connection

5. **Connection drops**:
   - The system will attempt to reconnect automatically
   - If problems persist, end the conversation and start a new one

## Limitations

- The voice chat feature requires an active internet connection to process audio.
- Performance depends on your internet connection speed and stability.
- The system works best in quiet environments with clear speech.
- Responses are limited to the information in the application's database.
- Very noisy environments may affect speech recognition quality.
