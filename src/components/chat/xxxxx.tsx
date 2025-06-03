// import {SpeechRecognition, SpeechRecognitionErrorEvent, SpeechRecognitionEvent} from '../../types/speech'
// import {useCallback, useEffect, useRef, useState} from 'react';
// import {Chat, GoogleGenAI} from '@google/genai';
// import {AgentStatus, BookingInfo, ChatMessage, PatientInfo} from '../../types/types.ts';
// import {GEMINI_MODEL_NAME, GEMINI_SYSTEM_PROMPT, INITIAL_AGENT_MESSAGE} from '../../constants';
// import ChatBubble from './ChatBubble.tsx';
// import BookingDetailsCard from '../booking/BookingDetailsCard.tsx';
// import {MicrophoneIcon, PlayIcon, RefreshCwIcon, StopIcon} from '../icons.tsx';
// import {getPatientInfo, getTripsUuid} from '@/src/services/tsApi.ts';
// import {separateTextAndJson} from "@/src/utils";
//
// const VoiceAgentFlow = () => {
//   const API_KEY = process.env.API_KEY;
//
//   const [agentStatus, setAgentStatus] = useState<AgentStatus>(AgentStatus.IDLE);
//   const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
//   const [currentUserTranscript, setCurrentUserTranscript] = useState<string>('');
//   const [currentAgentMessage, setCurrentAgentMessage] = useState<string>('');
//   const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
//   const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   // Add a state to track conversation state
//   const [conversationState, setConversationState] = useState<'initial' | 'verified' | 'collecting' | 'confirming'>('initial');
//
//   const geminiChatRef = useRef<Chat | null>(null);
//   const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
//   const lastSpokenAgentMessageRef = useRef<string>('');
//   const chatHistoryRef = useRef<HTMLDivElement>(null);
//   const currentUserTranscriptRef = useRef(currentUserTranscript);
//
//   useEffect(() => {
//     currentUserTranscriptRef.current = currentUserTranscript;
//   }, [currentUserTranscript]);
//
//   useEffect(() => {
//     if (bookingInfo) {
//       getTripsUuid();
//     }
//   }, [bookingInfo]);
//
//   useEffect(() => {
//     console.log(patientInfo)
//   }, [patientInfo]);
//
//   const scrollToBottom = () => {
//     chatHistoryRef.current?.scrollTo({top: chatHistoryRef.current.scrollHeight, behavior: 'smooth'});
//   };
//
//   useEffect(scrollToBottom, [chatHistory]);
//
//   const agentStatusRef = useRef(agentStatus);
//   useEffect(() => {
//     agentStatusRef.current = agentStatus;
//     if (agentStatus === AgentStatus.ENDED) {
//       console.log('ended');
//     }
//   }, [agentStatus]);
//
//   const speak = useCallback((text: string) => {
//     if (!text || !text.trim() || lastSpokenAgentMessageRef.current === text) {
//       if (agentStatusRef.current !== AgentStatus.ENDED && agentStatusRef.current !== AgentStatus.ERROR && agentStatusRef.current !== AgentStatus.NO_API_KEY) {
//         setAgentStatus(AgentStatus.IDLE);
//       }
//       return;
//     }
//
//     setAgentStatus(AgentStatus.SPEAKING);
//     lastSpokenAgentMessageRef.current = text;
//
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.lang = 'en-US';
//     utterance.onend = () => {
//       setCurrentAgentMessage('');
//       if (agentStatusRef.current !== AgentStatus.ENDED && agentStatusRef.current !== AgentStatus.ERROR && agentStatusRef.current !== AgentStatus.NO_API_KEY) {
//         setAgentStatus(AgentStatus.IDLE);
//       }
//     };
//     utterance.onerror = (event) => {
//       console.error('Speech synthesis error:', event.error);
//       setError(`Speech synthesis error: ${event.error || 'Unknown error'}`);
//       if (agentStatusRef.current !== AgentStatus.ENDED && agentStatusRef.current !== AgentStatus.ERROR && agentStatusRef.current !== AgentStatus.NO_API_KEY) {
//         setAgentStatus(AgentStatus.IDLE);
//       }
//     };
//     window.speechSynthesis.speak(utterance);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);
//
//   // Function to send context to Gemini after patient verification
//   const updatePatientContext = useCallback(async (patient: PatientInfo) => {
//     if (!geminiChatRef.current || !patient.name) return;
//
//     try {
//       // Set conversation state to verified
//       setConversationState('verified');
//
//       // Send a comprehensive context update that includes all conversation history
//       const contextMessage = `CONTEXT UPDATE: Patient ${patient.name} (Member ID: ${patient.memberId}) has been successfully verified.
//
// IMPORTANT: You are continuing an existing conversation. Do NOT start over or ask for verification again.
//
// CURRENT STATUS: Patient is verified and ready to book a trip.
// NEXT STEP: Ask the patient what date they need the ride for, using their name "${patient.name}".
//
// Continue the conversation naturally from where we left off.`;
//
//       const stream = await geminiChatRef.current.sendMessageStream({ message: contextMessage });
//
//       let fullAgentResponse = '';
//
//       // Update the last agent message instead of creating a new one
//       setChatHistory(prev => {
//         const lastMessage = prev[prev.length - 1];
//         if (lastMessage && lastMessage.sender === 'agent') {
//           return prev.map((msg, index) =>
//             index === prev.length - 1
//               ? { ...msg, text: '...' }
//               : msg
//           );
//         }
//         return prev;
//       });
//
//       for await (const chunk of stream) {
//         const chunkText = chunk.text;
//         if (chunkText) {
//           fullAgentResponse += chunkText;
//           setChatHistory(prev => {
//             const lastMessage = prev[prev.length - 1];
//             if (lastMessage && lastMessage.sender === 'agent') {
//               return prev.map((msg, index) =>
//                 index === prev.length - 1
//                   ? { ...msg, text: fullAgentResponse }
//                   : msg
//               );
//           }
//           return prev;
//         });
//       }
//     }
//
//     speak(fullAgentResponse);
//     console.log('Patient context updated in Gemini with name:', patient.name);
//
//   } catch (error) {
//     console.error('Error updating patient context:', error);
//   }
// }, [speak, setChatHistory]);
//
// const handleUserMessage = useCallback(async (text: string) => {
//   if (!text || !text.trim() || !geminiChatRef.current) {
//     if (agentStatusRef.current === AgentStatus.PROCESSING) {
//       setAgentStatus(AgentStatus.IDLE);
//     }
//     return;
//   }
//
//   setAgentStatus(AgentStatus.PROCESSING);
//   const newUserMessage: ChatMessage = {id: Date.now().toString(), sender: 'user', text, timestamp: new Date()};
//   setChatHistory(prev => [...prev, newUserMessage]);
//   setCurrentUserTranscript('');
//
//   try {
//     // Add context reminder for subsequent messages after verification
//     let messageToSend = text;
//     if (patientInfo && conversationState === 'verified') {
//       messageToSend = `CONTEXT: I am ${patientInfo.name}, already verified. User message: "${text}". Continue our conversation about booking my ride.`;
//       setConversationState('collecting');
//     } else if (patientInfo && conversationState === 'collecting') {
//       messageToSend = `CONTEXT: I am ${patientInfo.name}, we are in the middle of collecting trip details. User message: "${text}". Continue collecting information.`;
//     }
//
//     const stream = await geminiChatRef.current.sendMessageStream({message: messageToSend});
//     let fullAgentResponse = '';
//     const agentMessageId = Date.now().toString();
//
//     setChatHistory(prev => [...prev, {
//       id: agentMessageId,
//       sender: 'agent',
//       text: '...',
//       timestamp: new Date()
//     }]);
//
//     for await (const chunk of stream) {
//       const chunkText = chunk.text;
//       if (chunkText) {
//         fullAgentResponse += chunkText;
//         setChatHistory(prev => prev.map(msg => msg.id === agentMessageId ? {
//           ...msg,
//           text: fullAgentResponse
//         } : msg));
//       }
//     }
//     setCurrentAgentMessage(fullAgentResponse);
//
//     const {jsonBlock} = separateTextAndJson(fullAgentResponse.trim());
//     console.log({jsonBlock})
//     if (jsonBlock) {
//       try {
//         if (!patientInfo) {
//           const patientJson = JSON.parse(jsonBlock) as PatientInfo || null;
//           if (patientJson && patientJson.memberId && patientJson.dob && patientJson.organization) {
//             console.log('Patient info captured:', patientJson);
//             // Call the API with the newly parsed patient info
//             try {
//               const verifiedPatientInfo = await getPatientInfo(patientJson);
//               setPatientInfo(verifiedPatientInfo);
//
//               // Update context and continue conversation
//               await updatePatientContext(verifiedPatientInfo);
//               return; // Exit early to prevent duplicate responses
//
//             } catch (apiError) {
//               console.error('Error calling patient API:', apiError);
//               // Handle verification failure
//               const errorResponse = "I couldn't verify your information. Please check your Member ID, Date of Birth, and Organization and try again.";
//               setChatHistory(prev => [...prev, {
//                 id: Date.now().toString(),
//                 sender: 'agent',
//                 text: errorResponse,
//                 timestamp: new Date()
//               }]);
//               speak(errorResponse);
//               return;
//             }
//           }
//         } else {
//           const bookingInfoJson = {
//             ...JSON.parse(jsonBlock) as BookingInfo,
//             patientInfo: patientInfo
//           };
//           if (bookingInfoJson &&
//             bookingInfoJson.patientInfo.memberId &&
//             bookingInfoJson.itinerary.pickupDateTime
//           ) {
//             setBookingInfo(bookingInfoJson);
//             setAgentStatus(AgentStatus.ENDED);
//             setConversationState('confirming');
//             lastSpokenAgentMessageRef.current = fullAgentResponse;
//             console.log({bookingInfo});
//             return;
//           }
//         }
//       } catch (e) {
//         console.warn("Agent response looked like JSON but failed to parse:", e);
//       }
//     }
//
//     // Only speak if it's not a verification response that we're handling separately
//     console.log(fullAgentResponse)
//     speak(fullAgentResponse);
//
//   } catch (e) {
//     console.error("Error sending message to Gemini:", e);
//     const errorMsg = `Error communicating with AI: ${e instanceof Error ? e.message : String(e)}`;
//     setError(errorMsg);
//     setChatHistory(prev => [...prev, {
//       id: Date.now().toString(),
//       sender: 'agent',
//       text: errorMsg,
//       timestamp: new Date()
//     }]);
//     speak("I'm having a little trouble connecting right now. Please try again in a moment.");
//     setAgentStatus(AgentStatus.ERROR);
//   }
//   // eslint-disable-next-line react-hooks/exhaustive-deps
// }, [speak, patientInfo, updatePatientContext, conversationState]);
//
// const handleStartConversation = () => {
//   setChatHistory([]);
//   setPatientInfo(null);
//   setBookingInfo(null);
//   setConversationState('initial'); // Reset conversation state
//   setError(null);
//   setCurrentUserTranscript('');
//   setCurrentAgentMessage('');
//   lastSpokenAgentMessageRef.current = '';
//   window.speechSynthesis.cancel();
//
//   if (API_KEY) {
//     try {
//       const ai = new GoogleGenAI({apiKey: API_KEY});
//       geminiChatRef.current = ai.chats.create({
//         model: GEMINI_MODEL_NAME,
//         config: {systemInstruction: GEMINI_SYSTEM_PROMPT},
//       });
//     } catch (e) {
//       console.error("Failed to re-initialize Gemini:", e);
//       setError(`Failed to re-initialize AI services: ${e instanceof Error ? e.message : String(e)}`);
//       setAgentStatus(AgentStatus.ERROR);
//       return;
//     }
//   } else {
//     setAgentStatus(AgentStatus.NO_API_KEY);
//     return;
//   }
//
//   // Start with the initial greeting
//   handleUserMessage("Hello, I'd like to book a ride");
// };
//
// const startListening = useCallback(() => {
//   if (agentStatusRef.current === AgentStatus.NO_API_KEY || agentStatusRef.current === AgentStatus.ERROR || agentStatusRef.current === AgentStatus.ENDED || agentStatusRef.current === AgentStatus.SPEAKING) return;
//
//   window.speechSynthesis.cancel();
//   setCurrentUserTranscript('');
//   setError(null);
//   setAgentStatus(AgentStatus.LISTENING);
//   try {
//     if (speechRecognitionRef.current) {
//       (speechRecognitionRef.current as any).__statusBeforeStop = AgentStatus.LISTENING;
//       speechRecognitionRef.current.start();
//     }
//   } catch (e) {
//     console.error("Error starting speech recognition:", e);
//     setError(`Could not start voice input: ${e instanceof Error ? e.message : String(e)}`);
//     setAgentStatus(AgentStatus.ERROR);
//   }
// }, []);
//
// const stopListening = useCallback(() => {
//   if (agentStatusRef.current !== AgentStatus.LISTENING) return;
//
//   if (speechRecognitionRef.current) {
//     (speechRecognitionRef.current as any).__statusBeforeStop = agentStatusRef.current;
//   }
//
//   setAgentStatus(AgentStatus.PROCESSING);
//   speechRecognitionRef.current?.stop();
//
//   const finalTranscript = currentUserTranscriptRef.current.trim();
//   if (finalTranscript) {
//     handleUserMessage(finalTranscript);
//   }
// }, [handleUserMessage]);
//
//   const getButtonIcon = () => {
//     if (agentStatus === AgentStatus.LISTENING) return <StopIcon className="w-8 h-8"/>;
//     if (agentStatus === AgentStatus.IDLE || agentStatus === AgentStatus.ERROR) return <MicrophoneIcon
//       className="w-8 h-8"/>;
//     if (agentStatus === AgentStatus.PROCESSING) return <div
//       className="w-8 h-8 animate-spin rounded-full border-4 border-sky-300 border-t-transparent"></div>;
//     if (agentStatus === AgentStatus.SPEAKING) return <div className="w-8 h-8 animate-pulse text-2xl" role="img"
//                                                           aria-label="Speaking indicator">🔊</div>;
//     return <PlayIcon className="w-8 h-8"/>;
//   };
//
//   const getButtonAction = () => {
//     if (agentStatus === AgentStatus.LISTENING) return stopListening;
//     if (agentStatus === AgentStatus.IDLE || agentStatus === AgentStatus.ERROR) return startListening;
//     return () => {
//     };
//   };
//
//   const getButtonClass = () => {
//     if (agentStatus === AgentStatus.NO_API_KEY || agentStatus === AgentStatus.ENDED) return 'bg-slate-600 cursor-not-allowed';
//     if (agentStatus === AgentStatus.LISTENING) return 'bg-red-500 hover:bg-red-600';
//     if (agentStatus === AgentStatus.SPEAKING || agentStatus === AgentStatus.PROCESSING) return 'bg-teal-500 cursor-default';
//     return 'bg-sky-500 hover:bg-sky-600';
//   };
//
//   const isMainButtonDisabled = () => {
//     return agentStatus === AgentStatus.SPEAKING ||
//       agentStatus === AgentStatus.NO_API_KEY ||
//       agentStatus === AgentStatus.ENDED ||
//       agentStatus === AgentStatus.PROCESSING;
//   };
//
//   const getStatusMessage = () => {
//     switch (agentStatus) {
//       case AgentStatus.IDLE:
//         return chatHistory.length === 0 ? "Click 'Start Conversation'." : "Click mic to speak.";
//       case AgentStatus.LISTENING:
//         return "Listening...";
//       case AgentStatus.PROCESSING:
//         return "Thinking...";
//       case AgentStatus.SPEAKING:
//         return "Eva is speaking...";
//       case AgentStatus.ENDED:
//         return "Booking details captured!";
//       case AgentStatus.ERROR:
//         return "An error occurred. Try again or refresh.";
//       case AgentStatus.NO_API_KEY:
//         return "API Key not configured.";
//       default:
//         return "";
//     }
//   }
//
//   if (agentStatus === AgentStatus.NO_API_KEY) {
//     return (
//       <div
//         className="w-full max-w-2xl mx-auto bg-slate-800 shadow-xl rounded-lg p-6 border border-slate-700 text-center flex flex-col justify-center items-center"
//         style={{height: 'calc(100vh - 200px)', minHeight: '500px'}} role="alert">
//         <h2 className="text-2xl font-semibold text-red-400 mb-4">Configuration Error</h2>
//         <p
//           className="text-slate-300 mb-6">{error || "Gemini API Key is missing. Please ensure the API_KEY environment variable is set and the application is rebuilt/restarted if necessary."}</p>
//         <button
//           onClick={() => window.location.reload()}
//           className="mt-6 px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out flex items-center justify-center mx-auto"
//         >
//           <RefreshCwIcon className="w-5 h-5 mr-2"/> Try Reloading
//         </button>
//       </div>
//     );
//   }
//
//   return (
//     <div
//       className="w-full max-w-2xl mx-auto bg-slate-800/80 backdrop-blur-md shadow-2xl rounded-xl p-4 sm:p-6 border border-slate-700/50 flex flex-col"
//       style={{height: 'calc(100vh - 200px)', minHeight: '500px'}}>
//       {bookingInfo ? (
//         <BookingDetailsCard bookingInfo={bookingInfo} onStartNew={handleStartConversation}/>
//       ) : (
//         <>
//           <div ref={chatHistoryRef} className="chat-history flex-grow mb-4 overflow-y-auto pr-2 space-y-2"
//                aria-live="polite">
//             {chatHistory.map((msg) => <ChatBubble key={msg.id} message={msg}/>)}
//             {currentUserTranscript && agentStatus === AgentStatus.LISTENING && (
//               <div className="text-sky-300 italic self-end px-3 py-1 text-sm"
//                    aria-label="Current transcript">
//                 {currentUserTranscriptRef.current}...
//               </div>
//             )}
//           </div>
//
//           {error && agentStatus !== AgentStatus.NO_API_KEY &&
//             <p className="text-red-400 text-sm mb-2 text-center" role="alert">{error}</p>}
//
//           <div className="mt-auto pt-4 border-t border-slate-700/50">
//             <p className="text-center text-sm text-slate-400 mb-3 h-5"
//                aria-live="polite">{getStatusMessage()}</p>
//             <div className="flex items-center justify-center space-x-4">
//               {chatHistory.length === 0 && agentStatus === AgentStatus.IDLE && (
//                 <button
//                   onClick={handleStartConversation}
//                   className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full shadow-lg transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 flex items-center"
//                   aria-label="Start new conversation"
//                 >
//                   <PlayIcon className="w-6 h-6 mr-2" aria-hidden="true"/> Start Conversation
//                 </button>
//               )}
//               {chatHistory.length > 0 && (
//                 <button
//                   onClick={getButtonAction()}
//                   className={`p-4 rounded-full text-white transition duration-150 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 ${getButtonClass()} ${isMainButtonDisabled() ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110'}`}
//                   disabled={isMainButtonDisabled()}
//                   aria-label={agentStatus === AgentStatus.LISTENING ? "Stop listening" : "Start listening"}
//                 >
//                   {getButtonIcon()}
//                 </button>
//               )}
//               {chatHistory.length > 0 && agentStatus !== AgentStatus.ENDED && agentStatus !== AgentStatus.NO_API_KEY && (
//                 <button
//                   onClick={handleStartConversation}
//                   title="Reset Conversation"
//                   aria-label="Reset conversation"
//                   className="p-3 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-full shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-75"
//                   disabled={agentStatus === AgentStatus.SPEAKING || agentStatus === AgentStatus.PROCESSING || agentStatus === AgentStatus.LISTENING}
//                 >
//                   <RefreshCwIcon className="w-6 h-6" aria-hidden="true"/>
//                 </button>
//               )}
//             </div>
//           </div>
//         </>
//       )}
//     </div>
//   );
// };
//
// export default VoiceAgentFlow;