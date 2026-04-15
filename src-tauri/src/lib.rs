use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent,
};

#[tauri::command]
fn quit_app() {
    std::process::exit(0);
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn setup_tray(app: &tauri::AppHandle) {
    let show = MenuItem::with_id(app, "tray_show", "显示魔方简历", true, None::<&str>).unwrap();
    let quit = MenuItem::with_id(app, "tray_quit", "退出", true, None::<&str>).unwrap();
    let menu = Menu::with_items(app, &[&show, &quit]).unwrap();

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Magic Resume - 魔方简历")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray_show" => {
                show_main_window(app);
            }
            "tray_quit" => {
                std::process::exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)
        .unwrap();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![quit_app])
        .setup(|app| {
            // macOS: set native window styling
            #[cfg(target_os = "macos")]
            {
                if let Some(win) = app.get_webview_window("main") {
                    use objc::{class, msg_send, sel, sel_impl};
                    if let Ok(ptr) = win.ns_window() {
                        let ns_win = ptr as *mut objc::runtime::Object;
                        unsafe {
                            // Enable full-size content view for immersive title bar
                            let mask: u64 = msg_send![ns_win, styleMask];
                            let full_size_content_view: u64 = 1 << 15; // NSWindowStyleMaskFullSizeContentView
                            let _: () =
                                msg_send![ns_win, setStyleMask: mask | full_size_content_view];

                            // Make title bar transparent
                            let _: () = msg_send![ns_win, setTitlebarAppearsTransparent: true];

                            // Hide title text
                            let _: () = msg_send![ns_win, setTitleVisibility: 1_i64]; // NSWindowTitleHidden
                        }
                    }
                }
            }

            setup_tray(app.handle());

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[allow(clippy::single_match)]
            match event {
                RunEvent::ExitRequested { api, .. } => {
                    // Keep the app running in the background when the window is closed
                    api.prevent_exit();
                }
                _ => {
                    // macOS: handle dock icon click to reopen window
                    #[cfg(target_os = "macos")]
                    if let RunEvent::Reopen { .. } = &event {
                        show_main_window(app_handle);
                    }
                    let _ = app_handle; // suppress unused warning on non-macOS
                }
            }
        });
}
