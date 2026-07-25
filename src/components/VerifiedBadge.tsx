import { useState } from 'react';
import { TALKO_VERIFIED_SVG } from '../lib/assets';

interface VerifiedBadgeProps {
  className?: string;
}

export function VerifiedBadge({ className = "w-4 h-4" }: VerifiedBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-flex items-center ml-1">
      <button 
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTooltip(!showTooltip); }}
        className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full flex-shrink-0 ${className}`}
        dangerouslySetInnerHTML={{ __html: TALKO_VERIFIED_SVG }}
      />
      
      {showTooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none text-center border border-gray-700/50">
          <div className="font-semibold text-amber-500 mb-0.5">Talko Verified</div>
          <div className="text-gray-300">Bu hesap Talko tarafından doğrulanmış resmî bir hesaptır.</div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-800 rotate-45 border-r border-b border-gray-700/50"></div>
        </div>
      )}
    </div>
  );
}
