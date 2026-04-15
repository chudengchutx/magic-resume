use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, RunEvent,
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

fn setup_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
    // ─── File Menu ──────────────────────────────────────
    let new_resume = MenuItem::with_id(app, "new_resume", "新建简历", true, Some("CmdOrCtrl+N"))?;
    let save = MenuItem::with_id(app, "save", "保存", true, Some("CmdOrCtrl+S"))?;
    let export_pdf = MenuItem::with_id(app, "export_pdf", "导出 PDF", true, Some("CmdOrCtrl+P"))?;
    let close_window = PredefinedMenuItem::close_window(app, Some("关闭窗口"))?;

    let file_menu = Submenu::with_items(
        app,
        "文件",
        true,
        &[
            &new_resume,
            &PredefinedMenuItem::separator(app)?,
            &save,
            &export_pdf,
            &PredefinedMenuItem::separator(app)?,
            &close_window,
        ],
    )?;

    // ─── Edit Menu ──────────────────────────────────────
    let undo = PredefinedMenuItem::undo(app, Some("撤销"))?;
    let redo = PredefinedMenuItem::redo(app, Some("重做"))?;
    let cut = PredefinedMenuItem::cut(app, Some("剪切"))?;
    let copy = PredefinedMenuItem::copy(app, Some("复制"))?;
    let paste = PredefinedMenuItem::paste(app, Some("粘贴"))?;
    let select_all = PredefinedMenuItem::select_all(app, Some("全选"))?;

    let edit_menu = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &undo,
            &redo,
            &PredefinedMenuItem::separator(app)?,
            &cut,
            &copy,
            &paste,
            &PredefinedMenuItem::separator(app)?,
            &select_all,
        ],
    )?;

    // ─── View Menu ──────────────────────────────────────
    let dashboard = MenuItem::with_id(app, "goto_dashboard", "我的简历", true, Some("CmdOrCtrl+1"))?;
    let templates = MenuItem::with_id(app, "goto_templates", "简历模板", true, Some("CmdOrCtrl+2"))?;
    let ai_settings = MenuItem::with_id(app, "goto_ai_settings", "AI 服务商", true, Some("CmdOrCtrl+3"))?;
    let settings = MenuItem::with_id(app, "goto_settings", "通用设置", true, Some("CmdOrCtrl+,"))?;
    let fullscreen = PredefinedMenuItem::fullscreen(app, Some("进入全屏"))?;

    let view_menu = Submenu::with_items(
        app,
        "视图",
        true,
        &[
            &dashboard,
            &templates,
            &ai_settings,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &fullscreen,
        ],
    )?;

    // ─── Window Menu ────────────────────────────────────
    let minimize = PredefinedMenuItem::minimize(app, Some("最小化"))?;
    let zoom = PredefinedMenuItem::maximize(app, Some("缩放"))?;

    let window_menu = Submenu::with_items(
        app,
        "窗口",
        true,
        &[&minimize, &zoom],
    )?;

    // ─── Build and set the menu ─────────────────────────
    let menu = Menu::with_items(
        app,
        &[&file_menu, &edit_menu, &view_menu, &window_menu],
    )?;

    app.set_menu(menu)?;

    // ─── Handle custom menu events ──────────────────────
    app.on_menu_event(move |app, event| {
        let id = event.id.as_ref();
        match id {
            "new_resume" | "save" | "export_pdf" | "goto_dashboard" | "goto_templates"
            | "goto_ai_settings" | "goto_settings" => {
                let _ = app.emit("menu-action", id);
            }
            _ => {}
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
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

            setup_menu(app.handle())?;
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
