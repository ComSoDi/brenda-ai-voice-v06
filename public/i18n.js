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
    hint: "Connect and speak with pauses",
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
    hint: "Connect and speak with pauses",
    placeholder: "Conversation will appear here...",
    youLabel: "You",
    assistantLabel: "Brenda"
  },
  "es-ES": {
    connect: "Conecta",
    disconnect: "Desconectar",
    disconnected: "Desconectada",
    connecting: "Conectando",
    connected: "Conectada",
    speaking: "Hablando",
    hint: "Conecta y habla con pausas",
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
    hint: "Conecta y habla con pausas",
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
