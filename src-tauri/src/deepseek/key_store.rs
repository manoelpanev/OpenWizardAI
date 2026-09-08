use keyring::Entry;

const SERVICE: &str = "com.manoelpanev.openwizardai";
const USERNAME: &str = "deepseek-api-key";

/// Speichert den DeepSeek-API-Key im nativen, plattformspezifischen
/// verschlüsselten Store (macOS Keychain / Windows Credential Manager /
/// Linux Secret Service), per `keyring`-Crate-Abstraktion — siehe
/// CONCEPT.md, "DeepSeek-API-Key-Verwaltung". Kein Klartext auf Disk.
pub fn save_key(api_key: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;
    entry.set_password(api_key).map_err(|e| e.to_string())
}

pub fn load_key() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_key() -> Result<(), String> {
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
