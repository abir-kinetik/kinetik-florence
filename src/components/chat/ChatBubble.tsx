import { ChatMessage } from '../../types/types.ts';

interface ChatBubbleProps {
  message: ChatMessage;
}

const ChatBubble = ({ message }: ChatBubbleProps) => {
  const isUser = message.sender === 'user';
  const bubbleClasses = isUser
    ? 'bg-sky-500 text-white self-end rounded-l-xl rounded-tr-xl'
    : 'bg-slate-700 text-slate-200 self-start rounded-r-xl rounded-tl-xl';
  
  const avatarText = isUser ? 'You' : 'Florence';
  const avatarColor = isUser ? 'bg-sky-600' : 'bg-teal-600';

  return (
    <div className={`flex w-full mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-end gap-2 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
           <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-sm font-semibold text-white shrink-0`}>
             {avatarText.substring(0,1)}
           </div>
        )}
        <div className={`p-3 shadow-md ${bubbleClasses}`}>
          <p className="text-sm whitespace-pre-wrap">{message.text}</p>
        </div>
         {isUser && (
           <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-sm font-semibold text-white shrink-0`}>
             {avatarText.substring(0,1)}
           </div>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;