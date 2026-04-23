// ywd-logger-card.js v8.8
// UI Update: Added smart relative date/time formatting (Today, Yesterday, DD/MM)

const DEFAULT_CONFIG = {
  title: "Logger",
  icon: "mdi:notebook-edit",
  entity_id: "sensor.ywd_logger_data",
  hidden_card: false,
  categories: [
    { name: "Health", icon: "mdi:medical-bag", color: "#E8A0BF", presets: ["Took medication"] },
    { name: "Home", icon: "mdi:home-outline", color: "#80CBC4", presets: ["Cleaning"] }
  ],
};

const STYLES = `
  :host { display: block; }
  ha-card { background: transparent !important; border: none !important; box-shadow: none !important; cursor: pointer; }
  
  .tile-face { display: flex; flex-direction: column; align-items: center; padding: 12px; transition: transform 0.1s; }
  .tile-face:active { transform: scale(0.95); }
  .tile-icon-wrap { width: 64px; height: 64px; border-radius: 50%; background: rgba(120,120,120,0.15); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .tile-icon-wrap ha-icon { --mdc-icon-size: 32px; color: var(--primary-text-color); }
  .tile-title { font-size: 14px; font-weight: 500; color: var(--primary-text-color); }

  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .modal { background: var(--ha-card-background, #1c1b1f); border-radius: 28px; width: 95%; max-width: 500px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.6); overflow: hidden; color: var(--primary-text-color); animation: slideUp 0.3s cubic-bezier(0.34, 1.5, 0.64, 1); }
  
  @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes slideDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(40px); opacity: 0; } }
  @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .modal-content { padding: 20px 24px; overflow-y: auto; flex: 1; }
  
  .cat-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; align-items: center; }
  .cat-tab { padding: 8px 16px; border-radius: 20px; border: 1px solid var(--divider-color); background: transparent; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; transition: background 0.2s; }
  .cat-tab.active { border-color: transparent; color: white; font-weight: bold; }
  
  .log-input { width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.05); border: 2px solid var(--primary-color); border-radius: 12px; padding: 14px 16px; color: var(--primary-text-color); font-family: inherit; font-size: 16px; margin-bottom: 15px; outline: none; transition: background 0.2s; }
  .log-input:focus { background: rgba(255,255,255,0.08); }
  
  .presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; align-items: center; }
  .preset-chip { padding: 8px 14px; background: rgba(120,120,120,0.15); border: 1px solid var(--divider-color); border-radius: 18px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s; }
  .preset-chip:hover { background: rgba(120,120,120,0.25); }
  .preset-chip ha-icon { --mdc-icon-size: 14px; opacity: 0.5; transition: opacity 0.2s, color 0.2s; }
  .preset-chip ha-icon:hover { color: var(--error-color); opacity: 1; }
  .add-btn-circle { width: 34px; height: 34px; border-radius: 50%; border: 1px dashed var(--divider-color); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--secondary-text-color); flex-shrink: 0; transition: color 0.2s, border-color 0.2s; }
  .add-btn-circle:hover { color: var(--primary-color); border-color: var(--primary-color); }

  .entry-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: center; }
  .entry-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: white; }
  .entry-del { color: var(--secondary-text-color); cursor: pointer; padding: 8px; opacity: 0.5; transition: color 0.2s, opacity 0.2s; }
  .entry-del:hover { color: var(--error-color); opacity: 1; }

  .modal-actions { padding: 8px 16px 16px; display: flex; justify-content: flex-end; gap: 8px; }
  .btn { background: transparent; color: var(--primary-color); border: none; padding: 0 16px; height: 36px; border-radius: 4px; cursor: pointer; font-family: var(--paper-font-button_-_font-family, Roboto, sans-serif); font-weight: 500; text-transform: uppercase; font-size: 14px; letter-spacing: 1.25px; transition: background 0.2s; }
  .btn:hover { background: rgba(var(--rgb-primary-color), 0.08); }
`;

class YWDLoggerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._modalOpen = false;
    this._selectedCat = 0;
    this._entries = [];
    this._noteText = "";
    this._userPresets = {};

    window.addEventListener("hass-ywd-logger-open", () => {
      this._modalOpen = true;
      this._render();
    });
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid Configuration");
    this._config = JSON.parse(JSON.stringify({ ...DEFAULT_CONFIG, ...config }));
    this._loadLocalPresets();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config || !hass) return;

    const stateObj = hass.states[this._config.entity_id || "sensor.ywd_logger_data"];
    if (stateObj?.attributes?.entries) {
      const entries =
        typeof stateObj.attributes.entries === "string"
          ? JSON.parse(stateObj.attributes.entries)
          : stateObj.attributes.entries;

      const newEntries = entries.map((e) => {
        const cat =
          this._config.categories.find((c) => c.name === e.category) || {
            icon: "mdi:tag",
            color: "#9E9E9E",
          };
        return { ...e, icon: cat.icon, color: cat.color };
      });

      if (JSON.stringify(this._entries) !== JSON.stringify(newEntries)) {
        this._entries = newEntries;
        if (this._modalOpen) this._updateEntriesList();
      }
    }
  }

  getCardSize() {
    return this._config?.hidden_card ? 0 : 1;
  }

  _loadLocalPresets() {
    try {
      const stored = localStorage.getItem(`ywd_logger_user_presets_${this._config.entity_id}`);
      this._userPresets = stored ? JSON.parse(stored) : {};
    } catch {
      this._userPresets = {};
    }
  }

  _saveLocalPresets() {
    localStorage.setItem(
      `ywd_logger_user_presets_${this._config.entity_id}`,
      JSON.stringify(this._userPresets)
    );
  }

  _getMergedPresets(catName) {
    const globalPresets = this._config.categories.find((c) => c.name === catName)?.presets || [];
    const localPresets = this._userPresets[catName] || [];
    return [...new Set([...globalPresets, ...localPresets])];
  }

  _removeLocalPreset(catName, presetText) {
    if (this._userPresets[catName]) {
      this._userPresets[catName] = this._userPresets[catName].filter((p) => p !== presetText);
      this._saveLocalPresets();
      this._render();
    }
  }

  async _deleteEntry(ts) {
    this._entries = this._entries.filter((e) => e.ts !== ts);
    this._updateEntriesList();
    await this._hass.callApi("POST", "events/ywd_logger_delete_entry", { ts });
  }

  _closeModal() {
    const backdrop = this.shadowRoot.querySelector(".modal-backdrop");
    const modal = this.shadowRoot.querySelector(".modal");

    if (backdrop && modal) {
      backdrop.style.animation = "fadeOut 0.2s ease forwards";
      modal.style.animation = "slideDown 0.2s ease forwards";

      setTimeout(() => {
        this._modalOpen = false;
        this._noteText = "";
        this._render();
      }, 200);
    } else {
      this._modalOpen = false;
      this._noteText = "";
      this._render();
    }
  }

  async _submit() {
    const text = this.shadowRoot.querySelector(".log-input")?.value.trim();
    if (!text) return;

    const cat = this._config.categories[this._selectedCat];
    const user = this._hass.user?.name || "Unknown";
    const saveBtn = this.shadowRoot.querySelector("#btn-save");

    if (saveBtn) {
      saveBtn.textContent = "Saved ✓";
      saveBtn.style.background = "var(--success-color, #4CAF50)";
      saveBtn.style.color = "white";
    }

    this._hass.callService("logbook", "log", {
      name: cat.name,
      message: `[${user}] ${text}`,
      entity_id: this._config.entity_id,
      domain: "ywd_logger_card",
    });

    setTimeout(() => {
      this._closeModal();
    }, 1500);
  }

  _formatDate(ts) {
    const date = new Date(ts);
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const targetDay = new Date(date);
    targetDay.setHours(0, 0, 0, 0);

    if (targetDay.getTime() === today.getTime()) {
      return `Today at ${timeStr}`;
    } else if (targetDay.getTime() === yesterday.getTime()) {
      return `Yesterday at ${timeStr}`;
    } else {
      const dd = String(date.getDate()).padStart(2, "0");
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      return `${dd}/${mm} at ${timeStr}`;
    }
  }

  _updateEntriesList() {
    const list = this.shadowRoot.querySelector(".entries-section");
    if (!list) return;

    list.innerHTML = [...this._entries]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 10)
      .map(
        (e) => `
      <div class="entry-item">
        <div class="entry-icon" style="background:${e.color}"><ha-icon icon="${e.icon}" style="--mdc-icon-size:18px"></ha-icon></div>
        <div style="flex:1; font-size:14px">
          <div>${e.text}</div>
          <div style="font-size:11px; opacity:0.5">${e.user} • ${this._formatDate(e.ts)}</div>
        </div>
        <ha-icon icon="mdi:delete" class="entry-del" data-ts="${e.ts}"></ha-icon>
      </div>`
      )
      .join("");

    this.shadowRoot
      .querySelectorAll(".entry-del")
      .forEach((d) => (d.onclick = () => this._deleteEntry(parseInt(d.dataset.ts))));
  }

  _render() {
    if (!this._config) return;

    const cats = this._config.categories || [];
    const cat = cats[this._selectedCat] || cats[0] || { name: "Unknown" };
    const mergedPresets = this._getMergedPresets(cat.name);

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      
      ${
        !this._config.hidden_card
          ? `
        <ha-card id="open-tile">
          <div class="tile-face">
            <div class="tile-icon-wrap"><ha-icon icon="${this._config.icon}"></ha-icon></div>
            <div class="tile-title">${this._config.title}</div>
          </div>
        </ha-card>
      `
          : ""
      }
      
      ${
        this._modalOpen
          ? `
        <div class="modal-backdrop" id="backdrop">
          <div class="modal">
            <div class="modal-header">
              <h2 style="margin:0; font-weight: 400; font-size: 22px;">Logger</h2>
              <ha-icon icon="mdi:close" id="close-x" style="cursor:pointer"></ha-icon>
            </div>
            
            <div class="modal-content">
              <div class="cat-tabs">
                ${cats
                  .map(
                    (c, i) =>
                      `<div class="cat-tab ${i === this._selectedCat ? "active" : ""}" style="${
                        i === this._selectedCat ? "background:" + c.color : ""
                      }" data-i="${i}">${c.name}</div>`
                  )
                  .join("")}
              </div>
              
              <input type="text" 
                     class="log-input" 
                     name="ywd_logger_message_input" 
                     id="ywd_logger_message_input"
                     placeholder="What's happening?" 
                     value="${this._noteText}" 
                     autocomplete="off" 
                     data-bwignore="true" 
                     data-lpignore="true" 
                     data-1p-ignore="true" 
                     spellcheck="true">
              
              <div class="presets">
                ${mergedPresets
                  .map(
                    (p) => `
                  <div class="preset-chip">
                    <span class="preset-text" data-p="${p}">${p}</span>
                    ${
                      (this._userPresets[cat.name] || []).includes(p)
                        ? `<ha-icon icon="mdi:close" class="del-local-preset" data-p="${p}"></ha-icon>`
                        : ""
                    }
                  </div>
                `
                  )
                  .join("")}
                <div class="add-btn-circle" id="btn-add-preset" title="Save text as preset"><ha-icon icon="mdi:plus"></ha-icon></div>
              </div>

              <div class="entries-section"></div>
            </div>
            
            <div class="modal-actions">
              <button class="btn" id="btn-cancel">Cancel</button>
              <button class="btn" id="btn-save">Save</button>
            </div>
          </div>
        </div>
      `
          : ""
      }
    `;

    if (this._modalOpen) {
      this._updateEntriesList();
      setTimeout(() => this.shadowRoot.querySelector(".log-input")?.focus(), 100);

      this.shadowRoot.querySelector("#close-x").onclick = () => this._closeModal();
      this.shadowRoot.querySelector("#btn-cancel").onclick = () => this._closeModal();
      this.shadowRoot.querySelector("#btn-save").onclick = () => this._submit();

      const inputField = this.shadowRoot.querySelector(".log-input");
      inputField.oninput = (e) => (this._noteText = e.target.value);
      inputField.onkeypress = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this._submit();
        }
      };

      this.shadowRoot.querySelectorAll(".cat-tab").forEach((t) => {
        t.onclick = () => {
          this._selectedCat = parseInt(t.dataset.i);
          this._render();
        };
      });

      this.shadowRoot.querySelectorAll(".preset-text").forEach((p) => {
        p.onclick = () => {
          inputField.value = p.dataset.p;
          this._noteText = p.dataset.p;
        };
      });

      this.shadowRoot.querySelectorAll(".del-local-preset").forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          this._removeLocalPreset(cat.name, btn.dataset.p);
        };
      });

      this.shadowRoot.querySelector("#btn-add-preset").onclick = () => {
        const v = inputField.value.trim();
        if (v) {
          if (!this._userPresets[cat.name]) this._userPresets[cat.name] = [];
          if (!this._userPresets[cat.name].includes(v)) {
            this._userPresets[cat.name].push(v);
            this._saveLocalPresets();
            this._render();
          }
        }
      };
    } else if (!this._config.hidden_card) {
      this.shadowRoot.querySelector("#open-tile")?.addEventListener("click", () => {
        this._modalOpen = true;
        this._render();
      });
    }
  }

  static getConfigElement() {
    return document.createElement("ywd-logger-card-editor");
  }

  static getStubConfig() {
    return { ...DEFAULT_CONFIG };
  }
}

class YWDLoggerCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this._config = JSON.parse(JSON.stringify({ ...DEFAULT_CONFIG, ...config }));
    this._render();
  }

  _render() {
    if (!this._config) return;

    this.shadowRoot.innerHTML = `
      <style>
        .editor { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }
        .cat-card { border: 1px solid var(--divider-color); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--secondary-background-color); }
        .cat-header { display: flex; justify-content: space-between; align-items: center; }
        .cat-header h3 { margin: 0; font-size: 16px; font-weight: 400; color: var(--primary-text-color); }
        .del-icon { color: var(--error-color); cursor: pointer; }
        
        .row { display: flex; gap: 16px; align-items: center; width: 100%; }
        .row > * { flex: 1; }
        ha-textfield { width: 100%; }
        ha-icon-picker { width: 100%; }
        ha-formfield { padding: 8px 0; }
        
        .color-wrap { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .color-wrap label { font-family: var(--paper-font-caption_-_font-family, Roboto, sans-serif); font-size: 12px; color: var(--secondary-text-color); }
        input[type="color"] { width: 100%; height: 56px; padding: 0; border: 1px solid var(--divider-color); border-radius: 4px; cursor: pointer; background: var(--card-background-color); }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 4px; }
        input[type="color"]::-webkit-color-swatch { border-radius: 4px; border: none; }

        .add-btn { background: transparent; color: var(--primary-color); border: 1px solid var(--primary-color); border-radius: 4px; padding: 10px; font-family: var(--paper-font-button_-_font-family, Roboto, sans-serif); font-weight: 500; text-transform: uppercase; letter-spacing: 1.25px; cursor: pointer; transition: background 0.2s; }
        .add-btn:hover { background: rgba(var(--rgb-primary-color), 0.08); }
      </style>
      
      <div class="editor">
        <ha-formfield label="Hide card on dashboard (Keep as background listener)">
          <ha-switch id="hidden_card" ${this._config.hidden_card ? "checked" : ""}></ha-switch>
        </ha-formfield>

        <ha-textfield label="Title" id="title" value="${this._config.title}"></ha-textfield>
        <ha-textfield label="Entity ID" id="entity_id" value="${this._config.entity_id}"></ha-textfield>

        <h3 style="margin: 8px 0 0; color: var(--primary-text-color); font-weight: 400;">Categories</h3>

        <div style="display:flex; flex-direction:column; gap:16px;">
          ${(this._config.categories || [])
            .map(
              (c, i) => `
            <div class="cat-card">
              <div class="cat-header">
                <h3>Category ${i + 1}</h3>
                <ha-icon icon="mdi:delete" class="del-icon" data-i="${i}" title="Delete Category"></ha-icon>
              </div>
              
              <ha-textfield label="Category Name" class="c-name" data-i="${i}" value="${c.name}"></ha-textfield>
              
              <div class="row">
                <ha-icon-picker label="Icon" class="c-icon" data-i="${i}" value="${c.icon}"></ha-icon-picker>
                <div class="color-wrap">
                  <label>Color</label>
                  <input type="color" class="c-color" data-i="${i}" value="${c.color}">
                </div>
              </div>
              
              <ha-textfield label="Global Presets (Comma Separated)" class="c-pre" data-i="${i}" value="${(c.presets || []).join(", ")}"></ha-textfield>
            </div>
          `
            )
            .join("")}
        </div>
        
        <button class="add-btn" id="add-cat-btn">+ Add Category</button>
      </div>
    `;

    const fire = () =>
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: this._config },
          bubbles: true,
          composed: true,
        })
      );

    this.shadowRoot.querySelector("#hidden_card").addEventListener("change", (e) => {
      this._config.hidden_card = e.target.checked;
      fire();
    });

    this.shadowRoot.querySelectorAll("ha-textfield[id]").forEach((el) =>
      el.addEventListener("change", () => {
        if (el.id) this._config[el.id] = el.value;
        fire();
      })
    );

    this.shadowRoot.querySelectorAll(".c-name").forEach((el) =>
      el.addEventListener("change", () => {
        this._config.categories[el.dataset.i].name = el.value;
        fire();
      })
    );

    this.shadowRoot.querySelectorAll(".c-icon").forEach((el) =>
      el.addEventListener("value-changed", (e) => {
        this._config.categories[el.dataset.i].icon = e.detail.value;
        fire();
      })
    );

    this.shadowRoot.querySelectorAll(".c-color").forEach((el) =>
      el.addEventListener("change", (e) => {
        this._config.categories[el.dataset.i].color = e.target.value;
        fire();
      })
    );

    this.shadowRoot.querySelectorAll(".c-pre").forEach((el) =>
      el.addEventListener("change", () => {
        this._config.categories[el.dataset.i].presets = el.value
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        fire();
      })
    );

    this.shadowRoot.querySelectorAll(".del-icon").forEach((btn) =>
      btn.addEventListener("click", () => {
        this._config.categories.splice(btn.dataset.i, 1);
        fire();
        this._render();
      })
    );

    this.shadowRoot.querySelector("#add-cat-btn").addEventListener("click", () => {
      this._config.categories.push({
        name: "New Category",
        icon: "mdi:tag",
        color: "#9E9E9E",
        presets: [],
      });
      fire();
      this._render();
    });
  }
}

customElements.define("ywd-logger-card", YWDLoggerCard);
customElements.define("ywd-logger-card-editor", YWDLoggerCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ywd-logger-card",
  name: "YWD Logger Card",
  preview: true,
});
