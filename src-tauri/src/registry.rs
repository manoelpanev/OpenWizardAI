use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Ein selbst eingetragener API-Zugang. Strukturell wie ein Plugin
/// behandelt (CONCEPT.md, "Custom-API-Registry") — dieselben Felder wie
/// das Plugin-Registry-Schema, plus die API-spezifischen Felder
/// `endpoint_url` und `auth_method`. Der Key selbst liegt NICHT hier,
/// sondern im OS-Keychain (`key_store::custom_api_account`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomApiEntry {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    /// Immer "custom-api" für diese Einträge — hält das Feld kompatibel
    /// zum gemeinsamen Plugin-Schema (`own` | `claude-import` |
    /// `github-discovered` | `custom-api`).
    #[serde(default = "default_source")]
    pub source: String,
    #[serde(default)]
    pub target_tools: Vec<String>,
    pub endpoint_url: String,
    /// Wie der Key mitgeschickt wird. "bearer" (Authorization: Bearer …),
    /// "header" (eigener Header-Name in `auth_header`) oder "none".
    #[serde(default = "default_auth_method")]
    pub auth_method: String,
    #[serde(default)]
    pub auth_header: Option<String>,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default)]
    pub last_updated: Option<String>,
    /// Ergebnis des letzten technischen Health-Checks. Ein Eintrag gilt
    /// erst als aktiv nutzbar, wenn dieser Check erfolgreich war.
    #[serde(default)]
    pub health: Option<HealthReport>,
}

fn default_source() -> String {
    "custom-api".to_string()
}

fn default_auth_method() -> String {
    "bearer".to_string()
}

fn default_version() -> String {
    "1".to_string()
}

/// Ergebnis der rein technischen Prüfung eines Eintrags — CONCEPT.md legt
/// ausdrücklich fest: nur technische Checks, keine Inhalts-/Content-
/// Moderation der fremden API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthReport {
    pub reachable: bool,
    /// HTTP-Statuscode der Prüf-Anfrage, falls eine Antwort kam.
    pub status_code: Option<u16>,
    /// Ob die Antwort gültiges JSON war.
    pub json_valid: bool,
    /// Aus Standard-Headern erkanntes Rate-Limit, z.B. "retry-after: 30".
    pub rate_limit_hint: Option<String>,
    /// Dauer der Prüf-Anfrage in Millisekunden.
    pub duration_ms: u64,
    /// Menschenlesbare Zusammenfassung bzw. Fehlerursache.
    pub message: String,
}

/// Timeout für den Health-Check. Eine API, die langsamer antwortet, ist
/// für interaktive Wizard-Nutzung ohnehin nicht brauchbar.
const HEALTH_CHECK_TIMEOUT: Duration = Duration::from_secs(10);

/// Ohne User-Agent antworten manche APIs (z.B. api.github.com) mit 403,
/// was einen intakten Endpoint fälschlich als kaputt erscheinen ließe —
/// `reqwest` schickt von sich aus keinen.
const USER_AGENT: &str = concat!("OpenWizardAI/", env!("CARGO_PKG_VERSION"));

fn registry_path(config_dir: &Path) -> PathBuf {
    config_dir.join("custom-apis.json")
}

pub fn load_all(config_dir: &Path) -> Result<Vec<CustomApiEntry>, String> {
    let path = registry_path(config_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Registry konnte nicht gelesen werden ({}): {e}", path.display()))?;

    serde_json::from_str(&raw).map_err(|e| format!("Registry ist kein gültiges JSON: {e}"))
}

pub fn save_all(config_dir: &Path, entries: &[CustomApiEntry]) -> Result<(), String> {
    fs::create_dir_all(config_dir)
        .map_err(|e| format!("Konfigurationsordner konnte nicht angelegt werden: {e}"))?;

    let json = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("Registry konnte nicht serialisiert werden: {e}"))?;

    fs::write(registry_path(config_dir), json)
        .map_err(|e| format!("Registry konnte nicht geschrieben werden: {e}"))
}

/// Technischer Health-Check: Erreichbarkeit, Statuscode, JSON-Gültigkeit,
/// Rate-Limit-Header, Timeout. Bewertet ausdrücklich NICHT den Inhalt der
/// Antwort.
pub async fn check_health(entry: &CustomApiEntry, api_key: Option<&str>) -> HealthReport {
    let started = std::time::Instant::now();

    if !entry.endpoint_url.starts_with("https://") {
        return HealthReport {
            reachable: false,
            status_code: None,
            json_valid: false,
            rate_limit_hint: None,
            duration_ms: started.elapsed().as_millis() as u64,
            message: "Endpoint muss HTTPS nutzen — unverschlüsselte APIs werden abgelehnt."
                .to_string(),
        };
    }

    let client = match reqwest::Client::builder()
        .timeout(HEALTH_CHECK_TIMEOUT)
        .user_agent(USER_AGENT)
        .build()
    {
        Ok(client) => client,
        Err(e) => {
            return HealthReport {
                reachable: false,
                status_code: None,
                json_valid: false,
                rate_limit_hint: None,
                duration_ms: started.elapsed().as_millis() as u64,
                message: format!("HTTP-Client konnte nicht erstellt werden: {e}"),
            }
        }
    };

    let mut request = client.get(&entry.endpoint_url);

    if let Some(key) = api_key.filter(|k| !k.trim().is_empty()) {
        request = match entry.auth_method.as_str() {
            "bearer" => request.bearer_auth(key),
            "header" => {
                let header_name = entry.auth_header.as_deref().unwrap_or("X-API-Key");
                request.header(header_name, key)
            }
            _ => request,
        };
    }

    let response = match request.send().await {
        Ok(response) => response,
        Err(e) => {
            let message = if e.is_timeout() {
                format!(
                    "Timeout nach {} Sekunden — API antwortet zu langsam.",
                    HEALTH_CHECK_TIMEOUT.as_secs()
                )
            } else {
                format!("Nicht erreichbar: {e}")
            };
            return HealthReport {
                reachable: false,
                status_code: None,
                json_valid: false,
                rate_limit_hint: None,
                duration_ms: started.elapsed().as_millis() as u64,
                message,
            };
        }
    };

    let status = response.status();
    let rate_limit_hint = extract_rate_limit_hint(response.headers());
    let body = response.text().await.unwrap_or_default();
    let json_valid = serde_json::from_str::<serde_json::Value>(&body).is_ok();
    let duration_ms = started.elapsed().as_millis() as u64;

    // 401/403 heißt: Endpoint existiert und antwortet, nur die
    // Authentifizierung passt nicht — das ist ein anderer Fehler als
    // "nicht erreichbar" und wird dem Nutzer auch so gemeldet.
    let message = if status.is_success() {
        if json_valid {
            "Erreichbar, antwortet mit gültigem JSON.".to_string()
        } else {
            "Erreichbar, aber die Antwort war kein gültiges JSON.".to_string()
        }
    } else if status.as_u16() == 401 {
        format!("Erreichbar, aber Authentifizierung abgelehnt (HTTP {status}) — Key prüfen.")
    } else if status.as_u16() == 403 {
        format!("Erreichbar, aber Zugriff verweigert (HTTP {status}) — Key oder Berechtigungen prüfen.")
    } else if status.as_u16() == 429 {
        "Erreichbar, aber aktuell rate-limited (HTTP 429).".to_string()
    } else {
        format!("Erreichbar, antwortet aber mit HTTP {status}.")
    };

    HealthReport {
        reachable: status.is_success(),
        status_code: Some(status.as_u16()),
        json_valid,
        rate_limit_hint,
        duration_ms,
        message,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_entry(endpoint: &str) -> CustomApiEntry {
        CustomApiEntry {
            id: "higgsfield".to_string(),
            name: "Higgsfield".to_string(),
            description: "Bildgenerierung".to_string(),
            tags: vec!["bilder".to_string()],
            source: default_source(),
            target_tools: vec![],
            endpoint_url: endpoint.to_string(),
            auth_method: default_auth_method(),
            auth_header: None,
            version: default_version(),
            last_updated: None,
            health: None,
        }
    }

    #[test]
    fn missing_registry_file_is_empty_not_an_error() {
        let dir = std::env::temp_dir().join("owai-test-empty");
        let _ = fs::remove_dir_all(&dir);
        assert!(load_all(&dir).unwrap().is_empty());
    }

    #[test]
    fn entries_survive_a_save_load_round_trip() {
        let dir = std::env::temp_dir().join("owai-test-roundtrip");
        let _ = fs::remove_dir_all(&dir);

        let entries = vec![sample_entry("https://api.example.com/status")];
        save_all(&dir, &entries).unwrap();

        let loaded = load_all(&dir).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "higgsfield");
        assert_eq!(loaded[0].source, "custom-api");
        assert_eq!(loaded[0].endpoint_url, "https://api.example.com/status");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn saved_registry_never_contains_a_key_field() {
        let dir = std::env::temp_dir().join("owai-test-nokey");
        let _ = fs::remove_dir_all(&dir);

        save_all(&dir, &[sample_entry("https://api.example.com/status")]).unwrap();
        let raw = fs::read_to_string(registry_path(&dir)).unwrap();

        assert!(!raw.contains("api_key"));
        assert!(!raw.contains("apiKey"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn plain_http_endpoints_are_rejected_without_a_request() {
        let report = check_health(&sample_entry("http://api.example.com/status"), None).await;

        assert!(!report.reachable);
        assert!(report.status_code.is_none());
        assert!(report.message.contains("HTTPS"));
    }

    #[test]
    fn rate_limit_headers_are_summarised() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert("x-ratelimit-remaining", "42".parse().unwrap());
        headers.insert("retry-after", "30".parse().unwrap());

        let hint = extract_rate_limit_hint(&headers).unwrap();
        assert!(hint.contains("retry-after: 30"));
        assert!(hint.contains("x-ratelimit-remaining: 42"));
    }

    #[test]
    fn no_rate_limit_headers_means_no_hint() {
        let headers = reqwest::header::HeaderMap::new();
        assert!(extract_rate_limit_hint(&headers).is_none());
    }
}

fn extract_rate_limit_hint(headers: &reqwest::header::HeaderMap) -> Option<String> {
    const RATE_LIMIT_HEADERS: &[&str] = &[
        "retry-after",
        "x-ratelimit-remaining",
        "x-ratelimit-limit",
        "ratelimit-remaining",
    ];

    let hints: Vec<String> = RATE_LIMIT_HEADERS
        .iter()
        .filter_map(|name| {
            headers
                .get(*name)
                .and_then(|value| value.to_str().ok())
                .map(|value| format!("{name}: {value}"))
        })
        .collect();

    if hints.is_empty() {
        None
    } else {
        Some(hints.join(", "))
    }
}
