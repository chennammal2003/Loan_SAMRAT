import { useEffect, useState } from 'react';
import { Bell, Check, Eye, X, User, Building } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { markNotificationAsRead } from '../lib/notifications';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationsPanelProps {
  onApproveUser?: (userId: string, userType: 'merchant' | 'nbfc') => void;
  onViewUserDetails?: (userId: string) => void;
}

export default function NotificationsPanel({ onApproveUser, onViewUserDetails }: NotificationsPanelProps) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNotification, setExpandedNotification] = useState<string | null>(null);

  const fetchNotifications = async () => {
    if (!profile || profile.role !== 'super_admin') return;
    
    try {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .eq('admin_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel(`admin-notifications-${profile?.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications',
          filter: `admin_id=eq.${profile?.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
  };

  const handleApprove = async (notification: Notification) => {
    const userType = notification.payload?.profile_type === 'merchant' ? 'merchant' : 'nbfc';
    if (onApproveUser && notification.payload?.user_id) {
      onApproveUser(notification.payload.user_id, userType);
      await handleMarkAsRead(notification.id);
    }
  };

  const handleViewDetails = async (notification: Notification) => {
    if (onViewUserDetails && notification.payload?.user_id) {
      onViewUserDetails(notification.payload.user_id);
      await handleMarkAsRead(notification.id);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700">
      <div className="p-6 border-b border-slate-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
              <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Profile Notifications
            </h2>
          </div>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold min-w-[1.5rem] px-1 py-0.5">
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`border rounded-lg p-4 transition-colors ${
                  notification.is_read
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                    : 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${
                      notification.payload?.profile_type === 'merchant'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-purple-100 dark:bg-purple-900/30'
                    }`}>
                      {notification.payload?.profile_type === 'merchant' ? (
                        <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Building className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 dark:text-white">
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {new Date(notification.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      
                      {expandedNotification === notification.id && notification.payload && (
                        <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                            Profile Details:
                          </h4>
                          <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                            {notification.payload.business_name && (
                              <div><strong>Business:</strong> {notification.payload.business_name}</div>
                            )}
                            {notification.payload.nbfc_name && (
                              <div><strong>NBFC:</strong> {notification.payload.nbfc_name}</div>
                            )}
                            {notification.payload.business_type && (
                              <div><strong>Type:</strong> {notification.payload.business_type}</div>
                            )}
                            {notification.payload.nbfc_type && (
                              <div><strong>NBFC Type:</strong> {notification.payload.nbfc_type}</div>
                            )}
                            {notification.payload.phone && (
                              <div><strong>Phone:</strong> {notification.payload.phone}</div>
                            )}
                            {notification.payload.interest_rate && (
                              <div><strong>Interest Rate:</strong> {notification.payload.interest_rate}%</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setExpandedNotification(
                        expandedNotification === notification.id ? null : notification.id
                      )}
                      className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      title="Toggle details"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    
                    <button
                      onClick={() => handleViewDetails(notification)}
                      className="p-1.5 rounded bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50"
                      title="View user details"
                    >
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </button>
                    
                    <button
                      onClick={() => handleApprove(notification)}
                      className="p-1.5 rounded bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-800/50"
                      title="Approve user"
                    >
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </button>
                    
                    {!notification.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                        title="Mark as read"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
