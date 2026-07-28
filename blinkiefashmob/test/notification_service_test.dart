import 'package:blinkiefashmob/services/notification_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('setUnreadCount updates the notifier and clearUnread resets it', () {
    NotificationService.instance.clearUnread();
    NotificationService.instance.setUnreadCount(2);

    expect(NotificationService.instance.unreadCountNotifier.value, 2);

    NotificationService.instance.clearUnread();

    expect(NotificationService.instance.unreadCountNotifier.value, 0);
  });
}
