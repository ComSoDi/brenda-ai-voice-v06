// public/i18n.js
// Minimal UI strings for English + Spanish with regional variants.

const STRINGS = {
  "en-US": {
    connect: "Connect",
    disconnect: "Disconnect",
    disconnected: "Disconnected",
    connecting: "Connecting",
    connected: "Connected",
    speaking: "Speaking",
    hint: "Click Connect, speak, then pause ~1s.",
    placeholder: "Conversation will appear here...",
    youLabel: "You",
    assistantLabel: "Brenda"
  },
  "en-GB": {
    connect: "Connect",
    disconnect: "Disconnect",
    disconnected: "Disconnected",
    connecting: "Connecting",
    connected: "Connected",
    speaking: "Speaking",
    hint: "Click Connect, speak, then pause ~1s.",
    placeholder: "Conversation will appear here...",
    youLabel: "You",
    assistantLabel: "Brenda"
  },
  "es-ES": {
    connect: "Conectar",
    disconnect: "Desconectar",
    disconnected: "Desconectada",
    connecting: "Conectando",
    connected: "Conectada",
    speaking: "Hablando",
    hint: "Pulsa Conectar, habla y luego haz una pausa de ~1 s.",
    placeholder: "La conversación aparecerá aquí...",
    youLabel: "Tú",
    assistantLabel: "Brenda"
  },
  "es-419": {
    connect: "Conectar",
    disconnect: "Desconectar",
    disconnected: "Desconectada",
    connecting: "Conectando",
    connected: "Conectada",
    speaking: "Hablando",
    hint: "Haz clic en Conectar, habla y luego haz una pausa de ~1 s.",
    placeholder: "La conversación aparecerá aquí...",
    youLabel: "Tú",
    assistantLabel: "Brenda"
  }
};

export function t(localeVariant, key) {
  return (STRINGS[localeVariant] && STRINGS[localeVariant][key]) ||
         (STRINGS["en-US"][key]) ||
         key;
}
