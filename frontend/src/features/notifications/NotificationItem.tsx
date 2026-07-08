import type { Notification } from '../../domain/notification.ts';
import { Badge } from '../../components/Badge.tsx';
import { formatClockTime } from '../../utils/formatTime.ts';
import './NotificationItem.scss';

interface NotificationItemProps {
  notification: Notification;
}

// Pure presentational — renders one notification, no data fetching. The
// backend's message already includes the triggering event id as a debug
// prefix ("evt_...: agent a_11: ..."); stripped here since it's audit
// context, not something a team lead needs to read at a glance (it's still
// available in notification.context for anyone inspecting the network tab).
function stripEventIdPrefix(message: string): string {
  return message.replace(/^evt_\S+:\s*/, '');
}

export function NotificationItem({ notification }: NotificationItemProps) {
  return (
    <li className="notification-item">
      <div className="notification-item__rail-dot" aria-hidden="true" />
      <time className="notification-item__time" dateTime={notification.firedAt}>
        {formatClockTime(notification.firedAt)}
      </time>
      <div className="notification-item__card">
        <div className="notification-item__header">
          <Badge tone={notification.severity}>{notification.severity}</Badge>
        </div>
        <p className="notification-item__message">{stripEventIdPrefix(notification.message)}</p>
      </div>
    </li>
  );
}
