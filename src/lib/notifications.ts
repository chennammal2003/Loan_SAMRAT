import { supabase } from './supabase';

export interface NotificationData {
  type: 'merchant_profile_submitted' | 'nbfc_profile_submitted';
  userId: string;
  userName: string;
  userEmail: string;
  profileData?: any;
}

export async function createProfileSubmissionNotification(data: NotificationData) {
  try {
    // Get all super admins
    const { data: superAdmins, error: adminError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('role', 'super_admin')
      .eq('is_active', true);

    if (adminError) {
      console.error('Error fetching super admins:', adminError);
      return;
    }

    if (!superAdmins || superAdmins.length === 0) {
      console.warn('No active super admins found for notification');
      return;
    }

    // Create notification for each super admin
    const notifications = superAdmins.map(admin => ({
      admin_id: admin.id,
      type: data.type === 'merchant_profile_submitted' ? 'merchant_request' : 'system',
      title: data.type === 'merchant_profile_submitted' 
        ? 'New Merchant Profile Submitted'
        : 'New NBFC Profile Submitted',
      message: data.type === 'merchant_profile_submitted'
        ? `${data.userName} (${data.userEmail}) has completed their merchant profile and is awaiting approval.`
        : `${data.userName} (${data.userEmail}) has completed their NBFC profile and is awaiting verification.`,
      payload: {
        user_id: data.userId,
        user_name: data.userName,
        user_email: data.userEmail,
        profile_type: data.type === 'merchant_profile_submitted' ? 'merchant' : 'nbfc',
        submitted_at: new Date().toISOString(),
        ...data.profileData
      },
      is_read: false,
      created_at: new Date().toISOString()
    }));

    const { error: notificationError } = await supabase
      .from('admin_notifications')
      .insert(notifications);

    if (notificationError) {
      console.error('Error creating notifications:', notificationError);
    } else {
      console.log(`Created ${notifications.length} notifications for profile submission`);
    }
  } catch (error) {
    console.error('Error in createProfileSubmissionNotification:', error);
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
    }
  } catch (error) {
    console.error('Error in markNotificationAsRead:', error);
  }
}

export async function getUnreadNotificationsCount(adminId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', adminId)
      .eq('is_read', false);

    if (error) {
      console.error('Error getting unread notifications count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getUnreadNotificationsCount:', error);
    return 0;
  }
}
