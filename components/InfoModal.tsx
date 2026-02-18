import React from 'react';
import { X, Mail, Shield, FileText, Info } from 'lucide-react';

export type InfoType = 'about' | 'privacy' | 'terms' | null;

interface InfoModalProps {
  type: InfoType;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const renderContent = () => {
    switch (type) {
      case 'about':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Info className="text-indigo-600" /> About ClawReader
            </h3>
            <p>ClawReader is a free, web-based e-book reader and format converter designed to make digital reading accessible to everyone. Our mission is to provide a seamless reading experience directly in your browser without the need for software installation.</p>
            <p>Powered by advanced AI technology, ClawReader helps you summarize books, translate content, and gain deeper insights into your reading materials.</p>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mt-4">
              <h4 className="font-bold text-gray-800 mb-2">Contact Us</h4>
              <div className="flex items-center gap-2 text-indigo-600 font-medium">
                <Mail size={18} />
                <a href="mailto:wangfeiwest2025@gmail.com">wangfeiwest2025@gmail.com</a>
              </div>
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="text-green-600" /> Privacy Policy
            </h3>
            <p className="text-xs text-gray-500">Last Updated: May 2024</p>
            
            <h4 className="font-bold text-gray-800">1. Data Collection</h4>
            <p>ClawReader operates primarily as a client-side application. Your e-book files are processed locally in your browser and are not uploaded to our servers unless specifically required for AI processing, which is transient.</p>
            
            <h4 className="font-bold text-gray-800">2. Cookies & AdSense</h4>
            <p>We use Google AdSense to serve ads. Google uses cookies (including the DART cookie) to serve ads based on your visits to this site and other sites on the Internet.</p>
            <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to your website or other websites.</li>
                <li>Users may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" className="text-indigo-600 underline">Google Ads Settings</a>.</li>
            </ul>

            <h4 className="font-bold text-gray-800">3. Contact</h4>
            <p>If you have questions about this privacy policy, please contact us at: wangfeiwest2025@gmail.com</p>
          </div>
        );
      case 'terms':
        return (
          <div className="space-y-4">
             <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" /> Terms of Service
            </h3>
            <p>By using ClawReader, you agree to the following terms:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Usage:</strong> This tool is provided "as is" for free. We do not guarantee 100% uptime or accuracy in file conversion.</li>
              <li><strong>Copyright:</strong> Users are responsible for ensuring they have the right to view or convert the files they load into ClawReader. We do not endorse copyright infringement.</li>
              <li><strong>Liability:</strong> ClawReader is not liable for any data loss or damages resulting from the use of this service.</li>
            </ul>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 md:p-8 space-y-4 text-gray-600 leading-relaxed text-sm md:text-base">
           {renderContent()}
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50 rounded-b-3xl">
          <button 
            onClick={onClose} 
            className="px-6 py-2 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;