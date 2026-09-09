use keyring::Entry;

const SERVICE: &str = "com.manoelpanev.openwizardai";
const DEEPSEEK_ACCOUNT: &str = "deepseek-api-key";
const TAVILY_ACCOUNT: &str = "tavily-api-key";

/// Keychain-Account für den Key einer selbst eingetragenen API aus der
/// Custom-API-Registry (CONCEPT.md, "Custom-API-Registry").
pub fn custom_api_account(id: &str) -> String {
    format!("custom-api:{id}")
}

/// Speichert ein Secret im nativen, plattformspezifischen verschlüsselten
/// Store (macOS Keychain / Windows Credential Manager / Linux Secret
/// Service), per `keyring`-Crate-Abstraktion — siehe CONCEPT.md,
/// "DeepSeek-API-Key-Verwaltung". Kein Klartext auf Disk.
pub fn save_secret(account: &str, secret: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE, account).map_err(|e| e.to_string())?;
    entry.set_password(secret).map_err(|e| e.to_string())
}

pub fn load_secret(account: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, account).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_secret(account: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE, account).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn save_key(api_key: &str) -> Result<(), String> {
    save_secret(DEEPSEEK_ACCOUNT, api_key)
}

pub fn load_key() -> Result<Option<String>, String> {
    load_secret(DEEPSEEK_ACCOUNT)
}

pub fn delete_key() -> Result<(), String> {
    delete_secret(DEEPSEEK_ACCOUNT)
}

pub fn save_tavily_key(api_key: &str) -> Result<(), String> {
    save_secret(TAVILY_ACCOUNT, api_key)
}

pub fn load_tavily_key() -> Result<Option<String>, String> {
    load_secret(TAVILY_ACCOUNT)
}

pub fn delete_tavily_key() -> Result<(), String> {
    delete_secret(TAVILY_ACCOUNT)
}
