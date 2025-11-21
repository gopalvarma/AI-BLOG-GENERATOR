import React from 'react';

const LoadingSpinner = ({ className = "w-6 h-6" }: { className?: string }) => {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2" stroke="#4285F4" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 2C17.5228 2 22 6.47715 22 12" stroke="#34A853" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 10" className="opacity-60"/>
    </svg>
  );
};

export default LoadingSpinner;