use serde::Serialize;

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlatformCapabilities {
    platform: &'static str,
    execution_target: &'static str,
    offline: bool,
    file_access: &'static str,
}

fn local_capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        platform: "desktop",
        execution_target: "desktop",
        offline: true,
        file_access: "native",
    }
}

#[tauri::command]
fn platform_capabilities() -> PlatformCapabilities {
    local_capabilities()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![platform_capabilities])
        .run(tauri::generate_context!())
        .expect("Mosaico Desktop no pudo iniciar");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_local_offline_capabilities() {
        assert_eq!(local_capabilities().execution_target, "desktop");
        assert!(local_capabilities().offline);
        assert_eq!(local_capabilities().file_access, "native");
    }
}
