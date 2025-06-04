import { SpeechRecognition, SpeechRecognitionErrorEvent, SpeechRecognitionEvent } from '../../types/speech'
import { useCallback, useEffect, useRef, useState } from 'react';
import { Chat, GoogleGenAI } from '@google/genai';
import { AgentStatus, BookingInfo, ChatMessage, PatientInfo, TripManagementInfo, Trip } from '../../types/types.ts';
import { GEMINI_MODEL_NAME, GEMINI_SYSTEM_PROMPT, INITIAL_AGENT_MESSAGE, INITIAL_USER_TRIGGER_MESSAGE } from '../../constants';
import ChatBubble from './ChatBubble.tsx';
import BookingDetailsCard from '../booking/BookingDetailsCard.tsx';
import { MicrophoneIcon, PlayIcon, RefreshCwIcon, StopIcon } from '../icons.tsx';
import { createTrip, getPatientInfo, getTripData } from '@/src/services/tsApi.ts';
import { separateTextAndJson } from "@/src/utils";

const VoiceAgentFlow = () => {
  const API_KEY = process.env.API_KEY;

  const [agentStatus, setAgentStatus] = useState<AgentStatus>(AgentStatus.IDLE);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentUserTranscript, setCurrentUserTranscript] = useState<string>('');
  const [currentAgentMessage, setCurrentAgentMessage] = useState<string>('');
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<'initial' | 'verified' | 'collecting' | 'confirming'>('initial');

  const geminiChatRef = useRef<Chat | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const lastSpokenAgentMessageRef = useRef<string>('');
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const currentUserTranscriptRef = useRef(currentUserTranscript);

  useEffect(() => {
    currentUserTranscriptRef.current = currentUserTranscript;
  }, [currentUserTranscript]);

  useEffect(() => {
    if (bookingInfo) {
      console.log("Booking info set, calling getTripsUuid:", bookingInfo);
    }
  }, [bookingInfo]);

  useEffect(() => {
    if (patientInfo) {
      console.log("Patient info state updated:", patientInfo);
    }
  }, [patientInfo]);

  const scrollToBottom = () => {
    chatHistoryRef.current?.scrollTo({ top: chatHistoryRef.current.scrollHeight, behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [chatHistory]);

  const agentStatusRef = useRef(agentStatus);
  useEffect(() => {
    agentStatusRef.current = agentStatus;
    if (agentStatus === AgentStatus.ENDED) {
      console.log('Agent status: ENDED (Booking complete or conversation terminated)');
    }
    console.log('Agent status changed to:', agentStatus);
  }, [agentStatus]);

  const speak = useCallback((text: string) => {
    console.log("Speak called with text:", text);
    if (!text || !text.trim()) { // Allow speaking same message if lastSpokenAgentMessageRef check is removed
      console.log("Speak: Text is empty, returning. Current agent status:", agentStatusRef.current);
      if (agentStatusRef.current !== AgentStatus.ENDED && agentStatusRef.current !== AgentStatus.ERROR && agentStatusRef.current !== AgentStatus.NO_API_KEY) {
        setAgentStatus(AgentStatus.IDLE);
      }
      return;
    }
    // Optional: Re-add if re-speaking exact same consecutive message is an issue
    // if (lastSpokenAgentMessageRef.current === text) {
    //   console.log("Speak: Text is same as last spoken, returning.");
    //   if (agentStatusRef.current !== AgentStatus.ENDED && agentStatusRef.current !== AgentStatus.ERROR && agentStatusRef.current !== AgentStatus.NO_API_KEY) {
    //     setAgentStatus(AgentStatus.IDLE);
    //   }
    //   return;
    // }

    setAgentStatus(AgentStatus.SPEAKING);
    lastSpokenAgentMessageRef.current = text;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onend = () => {
      console.log("Speak: Utterance ended. Current agent status (before setting IDLE):", agentStatusRef.current);
      setCurrentAgentMessage('');
      if (agentStatusRef.current !== AgentStatus.ENDED && agentStatusRef.current !== AgentStatus.ERROR && agentStatusRef.current !== AgentStatus.NO_API_KEY) {
        setAgentStatus(AgentStatus.IDLE);
      }
    };
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error, "Full event:", event);
      setError(`Speech synthesis error: ${event.error || 'Unknown error'}`);
      if (agentStatusRef.current !== AgentStatus.ENDED && agentStatusRef.current !== AgentStatus.ERROR && agentStatusRef.current !== AgentStatus.NO_API_KEY) {
        setAgentStatus(AgentStatus.IDLE);
      }
    };
    window.speechSynthesis.speak(utterance);
  }, []);


  const updatePatientContext = useCallback(async (patient: PatientInfo) => {
    if (!geminiChatRef.current) {
      console.error("updatePatientContext: Gemini chat ref not available.");
      return;
    }
    // Assuming patient object from getPatientInfo will have a name or an identifier.
    // If patient.name can be undefined, ensure your PatientInfo type and getPatientInfo service handle this.
    // For the prompt, using patient.name as requested.
    const patientIdentifier = patient.name || patient.memberId; // Fallback to memberId if name is not present
    if (!patientIdentifier) {
      console.error("updatePatientContext: Patient identifier (name or memberId) is missing.");
      return;
    }

    console.log(`updatePatientContext called for patient: ${patientIdentifier}`);
    let fullAgentResponse = '';
    try {
      setConversationState('verified');
      const contextMessage = `
      CONTEXT UPDATE: Patient ${patientIdentifier} (Member ID: ${patient.memberId}) has been successfully verified.
      IMPORTANT: You are continuing an existing conversation. 
      Do NOT start over or ask for verification again. 
      CURRENT STATUS: Patient is verified and ready to proceeding next phase.`;

      const stream = await geminiChatRef.current.sendMessageStream({ message: contextMessage });

      const agentMessageId = `context-update-${Date.now()}`;
      // Add a placeholder for the agent's response to context update
      setChatHistory(prev => [...prev, {
        id: agentMessageId,
        sender: 'agent',
        text: '...',
        timestamp: new Date()
      }]);

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
          fullAgentResponse += chunkText;
          setChatHistory(prev => prev.map(msg =>
            msg.id === agentMessageId
              ? { ...msg, text: fullAgentResponse }
              : msg
          ));
        }
      }
      console.log('updatePatientContext: Gemini responded to context update:', fullAgentResponse);
      speak(fullAgentResponse);
    } catch (error) {
      console.error('Error in updatePatientContext (sending/receiving from Gemini):', error);
      speak("I had a little trouble confirming your details. Let's proceed, and please tell me what date you need the ride for.");
    }
  }, [speak]); // setChatHistory is stable, setConversationState is stable


  const handleJSONAction = useCallback(async (
    jsonContent: any,
    agentMessageId: string,
    fullAgentResponse: string
  ) => {
    const { jsonType, ...jsonData } = jsonContent;
    switch (jsonType) {
      case 'MEMBER_INFO':
        // Ensure the JSON has all necessary fields for verification as per your getPatientInfo needs
        const patientJson = jsonData as PatientInfo;
        if (patientJson && patientJson.memberId && patientJson.dob && patientJson.organization) {
          console.log('handleUserMessage: Potential patient info from JSON:', patientJson);
          try {
            const verifiedPatientInfo = await getPatientInfo(patientJson);
            if (!verifiedPatientInfo || !verifiedPatientInfo.memberId) { // Check if verification actually succeeded
              throw new Error("Verification service returned invalid data or failed to verify.");
            }
            console.log('handleUserMessage: Patient API verification successful:', verifiedPatientInfo);
            setPatientInfo(verifiedPatientInfo); // Set verified patient

            // Update Gemini's context and let it respond.
            // updatePatientContext will call speak() with Gemini's next message.
            await updatePatientContext(verifiedPatientInfo);
            return; // Important: updatePatientContext handles the next agent speech.

          } catch (apiError) {
            console.error('handleUserMessage: Patient API verification failed:', apiError);
            const errorResponse = "I couldn't verify your information. Please check your Member ID, Date of Birth, and Organization, then try again.";
            // Update chat with the agent message that led to this, then the error
            setChatHistory(prev => prev.map(msg => msg.id === agentMessageId ? { ...msg, text: fullAgentResponse } : msg));
            setChatHistory(prev => [...prev, { id: Date.now().toString(), sender: 'agent', text: errorResponse, timestamp: new Date() }]);
            speak(errorResponse);
            return;
          }
        } else {
          console.log("handleUserMessage: JSON block found, but not valid for patient verification, or patient already verified.");
        }
        break;
      case 'BOOKING_INFO':
        try {
          const bookingData = jsonContent as Partial<BookingInfo>; // May not be full BookingInfo yet
          // Construct booking info using the verified patientInfo from state
          const bookingInfoJson: BookingInfo = {
            ...bookingData, // Spread fields from JSON (like itinerary)
            patientInfo: patientInfo // Crucially, use the verified patient from state
          } as BookingInfo; // Assert type after combining

          // Check for essential booking details
          if (bookingInfoJson.itinerary && bookingInfoJson.itinerary.pickupDateTime && bookingInfoJson.patientInfo.memberId) {
            console.log('handleUserMessage: Booking info captured:', bookingInfoJson);
            setBookingInfo(bookingInfoJson);
            setConversationState('confirming');
            try {
              createTrip(bookingInfoJson);
            } catch (createTripError) {
              throw new Error(`Failed to create trip: ${createTripError}`);
            }
            // setAgentStatus(AgentStatus.ENDED);
            // The fullAgentResponse here should be Gemini's confirmation of the booking details.
            // lastSpokenAgentMessageRef.current = fullAgentResponse; // speak() handles this
            // speak(fullAgentResponse); // Speak the confirmation
            return; // Booking processed
          } else {
            console.log("handleUserMessage: JSON block found with patient verified, but not valid for booking confirmation.");
          }
        } catch (error) {
          console.error("handleUserMessage: Error processing JSON block:", error);
          const errorResponse = "I'm having a little trouble processing your booking. Please try again in a moment.";
          // Update chat with the agent message that led to this, then the error
          setChatHistory(prev => prev.map(msg => msg.id === agentMessageId ? { ...msg, text: fullAgentResponse } : msg));
          setChatHistory(prev => [...prev, { id: Date.now().toString(), sender: 'agent', text: errorResponse, timestamp: new Date() }]);
          speak(errorResponse);
          return;
        }
        break;
      case 'TRIP_MANAGEMENT':
        const tripData = jsonContent as TripManagementInfo;
        const trip: Trip | null = await getTripData(tripData);
        console.log(trip);
        break;
      case 'TRIP_CANCELLATION':
        const cancellationReason = jsonContent.displayText || "No reason provided";
        console.log("handleUserMessage: Trip cancellation requested with reason:", cancellationReason);
        break;
      case 'GRIEVANCE_INFO':
        const grievanceInfo = { patientInfo, issueDescription: jsonContent.issueDescription || "No description provided" };
        console.log("handleUserMessage: Grievance info captured:", grievanceInfo);
        break;
      case 'END_CONVERSATION':
        setAgentStatus(AgentStatus.ENDED);
        break;
      default:
        break;
    }
  }, [speak, setChatHistory, setPatientInfo, setBookingInfo, setConversationState, setAgentStatus]);

  const handleUserMessage = useCallback(async (text: string) => {
    console.log(`handleUserMessage called with text: "${text}", patientInfo:`, patientInfo, "conversationState:", conversationState);
    if (!text || !text.trim() || !geminiChatRef.current) {
      if (agentStatusRef.current === AgentStatus.PROCESSING) {
        setAgentStatus(AgentStatus.IDLE);
      }
      return;
    }

    setAgentStatus(AgentStatus.PROCESSING);
    const newUserMessage: ChatMessage = { id: Date.now().toString(), sender: 'user', text, timestamp: new Date() };

    if (text != INITIAL_USER_TRIGGER_MESSAGE) {
      setChatHistory(prev => [...prev, newUserMessage]);
    }

    setCurrentUserTranscript('');

    try {
      let messageToSend = text;
      if (patientInfo && conversationState === 'verified') {
        // Patient just got verified, updatePatientContext will handle the next Gemini prompt.
        // This explicit message prepending might be redundant if updatePatientContext is robust.
        // However, if updatePatientContext's response is what user replies to, then this context is for user's *next* message.
        messageToSend = `CONTEXT: I am ${patientInfo.name || patientInfo.memberId}, already verified. User message: "${text}". Continue our conversation about booking my ride.`;
        console.log("handleUserMessage: Patient is verified, setting conversationState to 'collecting'");
        setConversationState('collecting');
      } else if (patientInfo && conversationState === 'collecting') {
        messageToSend = `CONTEXT: I am ${patientInfo.name || patientInfo.memberId}, we are in the middle of collecting trip details. User message: "${text}". Continue collecting information.`;
      }
      console.log("handleUserMessage: Sending to Gemini:", messageToSend);

      const stream = await geminiChatRef.current.sendMessageStream({ message: messageToSend });
      let fullAgentResponse = '';
      const agentMessageId = Date.now().toString();

      setChatHistory(prev => [...prev, {
        id: agentMessageId,
        sender: 'agent',
        text: '...',
        timestamp: new Date()
      }]);

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
          fullAgentResponse += chunkText;
        }
      }

      setCurrentAgentMessage(fullAgentResponse);
      console.log("handleUserMessage: Gemini full response:", fullAgentResponse);

      const { jsonBlock } = separateTextAndJson(fullAgentResponse.trim());
      console.log("handleUserMessage: Extracted JSON block:", { jsonBlock });

      if (jsonBlock) {
        setChatHistory(prev => prev.map(msg => msg.id === agentMessageId ? {
          ...msg,
          text: "Thank you. Please wait, while we process your request."
        } : msg));

        setCurrentAgentMessage("Thank you. Please wait, while we process your request.");
        speak("Thank you. Please wait, while we process your request.")

        let parsedJsonContent;
        try {
          parsedJsonContent = JSON.parse(jsonBlock);
        } catch (parseError) {
          console.warn("handleUserMessage: JSON block failed to parse:", parseError, "JSON was:", jsonBlock);
          // Fall through to speak the fullAgentResponse as it might contain useful text.
        }

        if (parsedJsonContent) {
          handleJSONAction(parsedJsonContent, agentMessageId, fullAgentResponse);
        }
      }

      // If no JSON processed or if JSON was not for patient/booking, speak the regular response.
      console.log("handleUserMessage: No specific JSON action, speaking full response:", fullAgentResponse);

      setChatHistory(prev => prev.map(msg => msg.id === agentMessageId ? {
        ...msg,
        text: fullAgentResponse
      } : msg));
      speak(fullAgentResponse);

    } catch (e) {
      console.error("handleUserMessage: Error sending message to Gemini or in stream processing:", e);
      const errorMsg = `Error communicating with AI: ${e instanceof Error ? e.message : String(e)}`;
      setError(errorMsg);
      setChatHistory(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'agent',
        text: errorMsg, // Show technical error in chat for debugging
        timestamp: new Date()
      }]);
      speak("I'm having a little trouble connecting right now. Please try again in a moment.");
      setAgentStatus(AgentStatus.ERROR);
    }
  }, [speak, patientInfo, updatePatientContext, conversationState]);




  // useEffect for Speech Recognition setup
  useEffect(() => {
    console.log("Speech Reco useEffect: Running setup.");
    if (!API_KEY) {
      setAgentStatus(AgentStatus.NO_API_KEY);
      setError("API Key for Gemini is not configured.");
      console.log("Speech Reco useEffect: No API_KEY.");
      return;
    }

    // Initialize Gemini Chat if not already done (e.g. on API_KEY availability)
    // This part is typically handled by handleStartConversation or initial setup
    if (!geminiChatRef.current) {
      try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        geminiChatRef.current = ai.chats.create({
          model: GEMINI_MODEL_NAME,
          config: { systemInstruction: GEMINI_SYSTEM_PROMPT },
        });
        console.log("Speech Reco useEffect: Gemini chat initialized.");
      } catch (e) {
        console.error("Speech Reco useEffect: Failed to initialize Gemini:", e);
        setError(`Failed to initialize AI services: ${e instanceof Error ? e.message : String(e)}`);
        setAgentStatus(AgentStatus.ERROR);
        return;
      }
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError("Speech Recognition API is not supported in this browser.");
      setAgentStatus(AgentStatus.ERROR);
      console.log("Speech Reco useEffect: No SpeechRecognitionAPI support.");
      return;
    }

    console.log("Speech Reco useEffect: Initializing SpeechRecognitionAPI.");
    const recognitionInstance: SpeechRecognition = new SpeechRecognitionAPI();
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onstart = () => {
      console.log("Speech Reco: onstart event fired.");
    };

    recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      // console.log("Speech Reco: onresult - Interim:", interimTranscript, "Final:", finalTranscript);
      setCurrentUserTranscript(finalTranscript || interimTranscript);
    };

    recognitionInstance.onend = () => {
      console.log("Speech Reco: onend event fired. Status before stop:", (speechRecognitionRef.current as any)?.__statusBeforeStop);
      if (speechRecognitionRef.current && (speechRecognitionRef.current as any).__statusBeforeStop === AgentStatus.LISTENING) {
        const finalTranscript = currentUserTranscriptRef.current.trim();
        console.log("Speech Reco: onend - Final transcript:", finalTranscript);
        if (finalTranscript) {
          handleUserMessage(finalTranscript);
        } else {
          console.log("Speech Reco: onend - No final transcript. Setting agent status to IDLE.");
          if (agentStatusRef.current === AgentStatus.LISTENING || agentStatusRef.current === AgentStatus.PROCESSING) {
            setAgentStatus(AgentStatus.IDLE);
          }
        }
      }
      if (speechRecognitionRef.current) {
        (speechRecognitionRef.current as any).__statusBeforeStop = null;
      }
    };

    recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech Reco: onerror event:', event.error, event.message);
      setError(`Speech recognition error: ${event.error} (${event.message || 'No details'})`);
      // Avoid 'no-speech' or 'aborted' by user from spamming error state if not critical
      if (event.error !== 'no-speech' && event.error !== 'aborted' && agentStatusRef.current !== AgentStatus.ENDED && agentStatusRef.current !== AgentStatus.NO_API_KEY) {
        setAgentStatus(AgentStatus.IDLE); // Revert to IDLE to allow retry
      } else if (agentStatusRef.current === AgentStatus.LISTENING) {
        setAgentStatus(AgentStatus.IDLE); // If listening and error, go idle
      }
    };
    speechRecognitionRef.current = recognitionInstance;
    console.log("Speech Reco useEffect: SpeechRecognition instance created and assigned.");

    return () => {
      console.log("Speech Reco useEffect: Cleanup. Aborting previous instance if any.");
      speechRecognitionRef.current?.abort();
    };
  }, [API_KEY, handleUserMessage]); // handleUserMessage is a key dependency that changes


  const startListening = useCallback(() => {
    console.log("startListening called. Current agent status:", agentStatusRef.current);
    if (agentStatusRef.current === AgentStatus.NO_API_KEY || agentStatusRef.current === AgentStatus.ERROR || agentStatusRef.current === AgentStatus.ENDED || agentStatusRef.current === AgentStatus.SPEAKING) {
      console.log("startListening: Aborting due to agent status.");
      return;
    }

    if (!speechRecognitionRef.current) {
      console.error("startListening: speechRecognitionRef.current is null! Cannot start listening.");
      setError("Could not initialize voice input. Please try refreshing.");
      setAgentStatus(AgentStatus.ERROR);
      return;
    }

    window.speechSynthesis.cancel();
    setCurrentUserTranscript('');
    setError(null);
    setAgentStatus(AgentStatus.LISTENING);
    try {
      console.log("startListening: Calling speechRecognitionRef.current.start()");
      (speechRecognitionRef.current as any).__statusBeforeStop = AgentStatus.LISTENING;
      speechRecognitionRef.current.start();
    } catch (e) {
      console.error("Error starting speech recognition in startListening:", e);
      setError(`Could not start voice input: ${e instanceof Error ? e.message : String(e)}`);
      setAgentStatus(AgentStatus.ERROR);
    }
  }, []); // No direct dependencies needed here due to refs and direct setters

  const stopListening = useCallback(() => {
    console.log("stopListening called. Current agent status:", agentStatusRef.current);
    if (agentStatusRef.current !== AgentStatus.LISTENING) {
      console.log("stopListening: Not in LISTENING state, returning.");
      return;
    }

    if (!speechRecognitionRef.current) {
      console.error("stopListening: speechRecognitionRef.current is null!");
      return;
    }

    // Set status before stop, so onend knows if it was a deliberate stop or natural end.
    (speechRecognitionRef.current as any).__statusBeforeStop = agentStatusRef.current;

    // speechRecognitionRef.current.stop() will trigger onend, which then calls handleUserMessage if transcript is present
    // or sets state to IDLE. Setting to PROCESSING here might be premature if onend handles it.
    // However, it gives immediate feedback that system is "thinking".
    setAgentStatus(AgentStatus.PROCESSING);
    console.log("stopListening: Calling speechRecognitionRef.current.stop()");
    speechRecognitionRef.current.stop();

    // If speechRecognition.onend doesn't fire quickly or if we want to ensure processing:
    // const finalTranscript = currentUserTranscriptRef.current.trim();
    // if (finalTranscript) {
    //   console.log("stopListening: Force handling transcript immediately (usually onend does this):", finalTranscript);
    //   handleUserMessage(finalTranscript);
    // } else if (agentStatusRef.current === AgentStatus.PROCESSING) { // If set to processing but no transcript
    //   setAgentStatus(AgentStatus.IDLE);
    // }

  }, []); // Removed handleUserMessage, as onend callback (from useEffect) will use the latest handleUserMessage

  const handleStartConversation = () => {
    console.log("handleStartConversation called.");
    setChatHistory([]);
    setPatientInfo(null);
    setBookingInfo(null);
    setConversationState('initial');
    setError(null);
    setCurrentUserTranscript('');
    setCurrentAgentMessage('');
    lastSpokenAgentMessageRef.current = '';
    window.speechSynthesis.cancel();

    if (API_KEY) {
      if (geminiChatRef.current && typeof (geminiChatRef.current as any).destroy === 'function') {
        // (geminiChatRef.current as any).destroy(); // If a cleanup method exists
      }
      try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        geminiChatRef.current = ai.chats.create({
          model: GEMINI_MODEL_NAME,
          config: { systemInstruction: GEMINI_SYSTEM_PROMPT },
        });
        console.log("handleStartConversation: Gemini chat re-initialized.");
      } catch (e) {
        console.error("Failed to re-initialize Gemini:", e);
        setError(`Failed to re-initialize AI services: ${e instanceof Error ? e.message : String(e)}`);
        setAgentStatus(AgentStatus.ERROR);
        return;
      }
    } else {
      console.log("handleStartConversation: No API_KEY. Setting status.");
      setAgentStatus(AgentStatus.NO_API_KEY);
      return;
    }

    console.log("handleStartConversation: Simulating initial user message.");
    // This will trigger the first turn with Gemini
    handleUserMessage(INITIAL_USER_TRIGGER_MESSAGE);
  };

  // --- UI Helper Functions ---
  const getButtonIcon = () => {
    if (agentStatus === AgentStatus.LISTENING) return <StopIcon className="w-8 h-8" />;
    if (agentStatus === AgentStatus.IDLE || agentStatus === AgentStatus.ERROR) return <MicrophoneIcon className="w-8 h-8" />;
    if (agentStatus === AgentStatus.PROCESSING) return <div className="w-8 h-8 animate-spin rounded-full border-4 border-sky-300 border-t-transparent" role="status"></div>;
    if (agentStatus === AgentStatus.SPEAKING) return <div className="w-8 h-8 animate-pulse text-2xl" role="img" aria-label="Speaking indicator">🔊</div>;
    return <PlayIcon className="w-8 h-8" />;
  };

  const getButtonAction = () => {
    if (agentStatus === AgentStatus.LISTENING) return stopListening;
    if (agentStatus === AgentStatus.IDLE || agentStatus === AgentStatus.ERROR) return startListening;
    return () => { };
  };

  const getButtonClass = () => {
    if (agentStatus === AgentStatus.NO_API_KEY || agentStatus === AgentStatus.ENDED) return 'bg-slate-600 cursor-not-allowed';
    if (agentStatus === AgentStatus.LISTENING) return 'bg-red-500 hover:bg-red-600';
    if (agentStatus === AgentStatus.SPEAKING || agentStatus === AgentStatus.PROCESSING) return 'bg-teal-500 cursor-default';
    return 'bg-sky-500 hover:bg-sky-600';
  };

  const isMainButtonDisabled = () => {
    return agentStatus === AgentStatus.SPEAKING ||
      agentStatus === AgentStatus.NO_API_KEY ||
      agentStatus === AgentStatus.ENDED ||
      agentStatus === AgentStatus.PROCESSING;
  };

  const getStatusMessage = () => {
    switch (agentStatus) {
      case AgentStatus.IDLE:
        return chatHistory.length === 0 ? "Click 'Start Conversation'." : "Click mic to speak.";
      case AgentStatus.LISTENING:
        return "Listening...";
      case AgentStatus.PROCESSING:
        return "Thinking...";
      case AgentStatus.SPEAKING:
        return "Eva is speaking...";
      case AgentStatus.ENDED:
        return "Booking details captured!";
      case AgentStatus.ERROR:
        return error || "An error occurred. Try again or refresh."; // Display specific error
      case AgentStatus.NO_API_KEY:
        return "API Key not configured.";
      default:
        return "";
    }
  };

  if (agentStatus === AgentStatus.NO_API_KEY && !API_KEY) { // Double check to ensure this screen only shows if truly no key
    return (
      <div
        className="w-full max-w-2xl mx-auto bg-slate-800 shadow-xl rounded-lg p-6 border border-slate-700 text-center flex flex-col justify-center items-center"
        style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }} role="alert">
        <h2 className="text-2xl font-semibold text-red-400 mb-4">Configuration Error</h2>
        <p className="text-slate-300 mb-6">{error || "Gemini API Key is missing. Please ensure the API_KEY environment variable is set and the application is rebuilt/restarted if necessary."}</p>
        <button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-md flex items-center">
          <RefreshCwIcon className="w-5 h-5 mr-2" /> Try Reloading
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-2xl mx-auto bg-slate-800/80 backdrop-blur-md shadow-2xl rounded-xl p-4 sm:p-6 border border-slate-700/50 flex flex-col"
      style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
      {bookingInfo && agentStatus === AgentStatus.ENDED ? (
        <BookingDetailsCard bookingInfo={bookingInfo} onStartNew={handleStartConversation} />
      ) : (
        <>
          <div ref={chatHistoryRef} className="chat-history flex-grow mb-4 overflow-y-auto pr-2 space-y-2 scroll-smooth" aria-live="polite">
            {chatHistory.map((msg) => <ChatBubble key={msg.id} message={msg} />)}
            {currentUserTranscript && (agentStatus === AgentStatus.LISTENING || agentStatus === AgentStatus.PROCESSING) && (
              <div className="text-sky-300 italic self-end px-3 py-1 text-sm text-right" aria-label="Your current speech input">
                {currentUserTranscriptRef.current}...
              </div>
            )}
          </div>

          {error && agentStatus !== AgentStatus.NO_API_KEY &&
            <p className="text-red-400 text-sm mb-2 text-center" role="alert">{error}</p>}

          <div className="mt-auto pt-4 border-t border-slate-700/50">
            <p className="text-center text-sm text-slate-400 mb-3 h-5" aria-live="polite">{getStatusMessage()}</p>
            <div className="flex items-center justify-center space-x-4">
              {chatHistory.length === 0 && agentStatus === AgentStatus.IDLE && API_KEY && (
                <button
                  onClick={handleStartConversation}
                  className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full shadow-lg transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 flex items-center"
                  aria-label="Start new conversation">
                  <PlayIcon className="w-6 h-6 mr-2" aria-hidden="true" /> Start Conversation
                </button>
              )}
              {chatHistory.length > 0 && (
                <button
                  onClick={getButtonAction()}
                  className={`p-4 rounded-full text-white transition duration-150 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 ${getButtonClass()} ${isMainButtonDisabled() ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110'}`}
                  disabled={isMainButtonDisabled()}
                  aria-label={agentStatus === AgentStatus.LISTENING ? "Stop listening" : "Start listening"}>
                  {getButtonIcon()}
                </button>
              )}
              {chatHistory.length > 0 && agentStatus !== AgentStatus.ENDED && agentStatus !== AgentStatus.NO_API_KEY && (
                <button
                  onClick={handleStartConversation}
                  title="Reset Conversation"
                  aria-label="Reset conversation"
                  className="p-3 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-full shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-75 disabled:opacity-50"
                  disabled={agentStatus === AgentStatus.SPEAKING || agentStatus === AgentStatus.PROCESSING || agentStatus === AgentStatus.LISTENING}>
                  <RefreshCwIcon className="w-6 h-6" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceAgentFlow;