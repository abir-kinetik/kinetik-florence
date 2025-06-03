import VoiceAgentFlow from './components/chat/VoiceAgentFlow.tsx';

const App = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-400">
          AI Voice Booking Agent
        </h1>
        <p className="mt-3 text-lg text-slate-400">
          Converse with our AI to schedule your ride.
        </p>
      </header>
      <VoiceAgentFlow />
      <footer className="mt-12 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} SwiftRide Booking Services. All rights reserved.</p>
        <p>Powered by Gemini & React</p>
      </footer>
    </div>
  );
};

export default App;