// public/src/components/NotificationBanner.jsx
import { useEffect, useState } from 'react';

const NotificationBanner = () => {
  const [notification, setNotification] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Custom event listener for triggering notifications
    const handleNotification = (e) => {
        const { message, type } = e.detail;
        setNotification({ message, type });
        setIsVisible(true);

        // Auto hide after 3 seconds
        setTimeout(() => {
           setIsVisible(false);
        }, 3000);
    };

    window.addEventListener('walletwise-notification', handleNotification);
    return () => window.removeEventListener('walletwise-notification', handleNotification);
  }, []);

  if (!notification) return null;

  const typeConfig = {
      success: 'bg-green-500',
      error: 'bg-red-600',
      info: 'bg-indigo-600'
  };

  const bgColor = typeConfig[notification.type] || typeConfig.error;

  return (
    <div 
        className={`fixed top-0 left-0 right-0 p-4 z-100 text-center text-white font-bold shadow-lg transition-transform duration-300 ease-in-out ${isVisible ? 'translate-y-0' : '-translate-y-full'} ${bgColor}`}
        onClick={() => setIsVisible(false)}
    >
        <span id="notification-message">
            {notification.message}
        </span>
    </div>
  );
};

export default NotificationBanner;
