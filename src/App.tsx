import VoiceAgentFlow from './components/chat/VoiceAgentFlow.tsx';
import Logo from './assets/logo.png'; // Dummy path for your logo

const App = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#030c1f] via-[#08152c] to-[#122340] text-slate-100">
      <header className="mb-8 text-center">
        {/* Kinetik Logo */}
        <div className='flex items-center justify-center'> {/* Using 'items-center' for correct vertical alignment */}
          <img 
            src={Logo} 
            alt="Kinetik Logo" 
            className="h-16 w-auto mr-4" // Added 'mr-4' for a 16px right margin (gap)
          /> 

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-400">
            Florence
          </h1>
        </div>
        <p className="mt-3 text-lg text-slate-400">
          Kinetik's Intelligent Transportation Partner
        </p>
      </header>
      <VoiceAgentFlow />
      <footer className="mt-12 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Kinetik Healthcare Solutions. All rights reserved.</p>
        <p>Powered by Gemini & React</p>
      </footer>
    </div>
  );
};

export default App;