import { setupAuthSync } from './authSync';
import { setupContextMenuListeners } from './contextMenu';
import { setupMessageHandlers } from './messageHandlers';
import { setupLifecycle } from './lifecycle';

setupAuthSync();
setupContextMenuListeners();
setupMessageHandlers();
setupLifecycle();
