// The music player's interface: a group of buttons in the toolbar (in fullscreen it
// becomes a strip at the right edge) and a dialog for choosing what to play.

import { loadLibrary } from "../music/library";
import { MODES, MusicPlayer, type Mode } from "../music/player";
import { setIcon } from "./icons";
import { setTip } from "./toolbar";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const MODE_NAMES: Record<Mode, string> = { tracks: "Tracks", midi: "MIDI", live: "Live radio" };

const EMPTY: Record<Mode, string> = {
  tracks: "No tracks in this build.",
  midi: "No MIDI files in this build. You can play one from your computer.",
  live: "No stations are listed yet. You can play a stream address of your own.",
};

export async function setupMusic(onClose: () => void): Promise<void> {
  const player = new MusicPlayer(await loadLibrary());
  Object.assign(window, { aaMusic: player }); // for debugging in the console

  const toggle = $<HTMLButtonElement>("music-toggle");
  const next = $<HTMLButtonElement>("music-next");
  const volume = $<HTMLInputElement>("music-volume");
  const open = $<HTMLButtonElement>("open-music");
  const dialog = $<HTMLDialogElement>("music-dialog");
  const status = $("music-status");
  const modes = $("music-modes");
  const list = $("music-list");
  const extra = $("music-extra");
  const dialogVolume = $<HTMLInputElement>("music-dialog-volume");

  // ----- Toolbar -----

  const showToolbar = () => {
    setIcon(toggle.firstElementChild as Element, player.playing ? "pause" : "play");
    const name = player.current?.entry.title;
    setTip(toggle, player.playing ? `Pause music${name ? `: ${name}` : ""}` : name ? `Play music: ${name}` : "Play music");
    toggle.setAttribute("aria-pressed", String(player.playing));
    next.disabled = player.entries(player.current?.mode ?? player.mode).length === 0;
    volume.value = String(Math.round(player.volume * 100));
    dialogVolume.value = volume.value;
    (dialogVolume.nextElementSibling as HTMLOutputElement).textContent = `${volume.value}%`;
    toggle.disabled = !player.current && MODES.every((m) => player.entries(m).length === 0);
  };

  toggle.addEventListener("click", () => void player.toggle());
  next.addEventListener("click", () => void player.next());
  const onVolume = (e: Event) => player.setVolume(Number((e.target as HTMLInputElement).value) / 100);
  volume.addEventListener("input", onVolume);
  dialogVolume.addEventListener("input", onVolume);

  // ----- Dialog -----

  for (const mode of MODES) {
    const label = document.createElement("label");
    label.innerHTML = `<input type="radio" name="music-mode" value="${mode}" /><span></span>`;
    label.querySelector("span")!.textContent = MODE_NAMES[mode];
    modes.append(label);
  }
  modes.addEventListener("change", (e) => {
    const radio = e.target as HTMLInputElement;
    if (radio.name === "music-mode") player.setMode(radio.value as Mode);
  });

  const renderList = () => {
    list.replaceChildren();
    const entries = player.entries(player.mode);
    if (!entries.length) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = EMPTY[player.mode];
      list.append(p);
    }
    for (const entry of entries) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "music-item";
      const on = player.current?.mode === player.mode && player.current.entry.id === entry.id;
      b.setAttribute("aria-current", String(on));
      b.innerHTML = "<b></b><small></small>";
      b.querySelector("b")!.textContent = entry.title;
      b.querySelector("small")!.textContent = entry.detail ?? "";
      b.addEventListener("click", () => void player.play(player.mode, entry));
      list.append(b);
    }
  };

  const renderExtra = () => {
    extra.replaceChildren();
    if (player.mode === "midi") {
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "text-button";
      pick.textContent = "Play a MIDI file from your computer…";
      pick.addEventListener("click", () => $<HTMLInputElement>("music-file").click());
      extra.append(pick);
    }
    if (player.mode === "live") {
      const form = document.createElement("form");
      form.className = "actions";
      form.innerHTML = `<input type="url" placeholder="https://… address of an audio stream" aria-label="Stream address" /><button class="text-button" type="submit">Play</button>`;
      const input = form.querySelector("input")!;
      input.value = player.streamUrl;
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const url = input.value.trim();
        if (!url) return;
        if (location.protocol === "https:" && url.startsWith("http:")) {
          player.message = "Browsers block http:// streams on this page. Use an https:// address.";
          renderStatus();
          return;
        }
        player.setStreamUrl(url);
        const entry = player.entries("live").find((s) => s.id === "custom");
        if (entry) void player.play("live", entry);
      });
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Only use streams whose operator allows listening in a web page. The site does not host or copy them; your browser connects to the stream directly.";
      extra.append(form, hint);
    }
  };

  const renderStatus = () => {
    status.textContent = player.message;
  };

  const renderCredits = () => {
    const credits = $("music-credits");
    credits.replaceChildren();
    const lib = player.library;
    const add = (title: string, author: string, license: string, page: string) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = page;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = title;
      li.append(a, ` by ${author}, ${license}`);
      credits.append(li);
    };
    for (const t of [...lib.tracks, ...lib.midi]) add(t.title, t.author, t.license, t.page);
    if (lib.soundfont) add(lib.soundfont.name, lib.soundfont.author, lib.soundfont.license, lib.soundfont.page);
    $("music-credits-box").hidden = credits.childElementCount === 0;
  };

  const render = () => {
    showToolbar();
    renderStatus();
    modes.querySelectorAll<HTMLInputElement>("input").forEach((r) => (r.checked = r.value === player.mode));
    renderList();
    if (dialog.open) renderExtraOnce();
  };

  // The extra area holds inputs: only rebuild it when the mode changes, not on every player event.
  let extraMode: Mode | undefined;
  const renderExtraOnce = () => {
    if (extraMode === player.mode) return;
    extraMode = player.mode;
    renderExtra();
  };

  player.onChange(render);

  const fileInput = $<HTMLInputElement>("music-file");
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const entry = player.addMidiFile(file.name, await file.arrayBuffer());
    void player.play("midi", entry);
    fileInput.value = "";
  });

  open.addEventListener("click", () => {
    extraMode = undefined;
    render();
    renderExtraOnce();
    dialog.showModal();
  });
  $("close-music").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", onClose);

  renderCredits();
  render();
  open.disabled = false;
}
