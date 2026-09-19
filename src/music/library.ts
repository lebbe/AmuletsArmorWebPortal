// What the music player can play, from public/music/index.json (written at build time
// by scripts/fetch-music.mjs from music.json).

export const MUSIC_BASE = `${import.meta.env.BASE_URL}music/`;

export interface Piece {
  id: string;
  title: string;
  /** Path of the file inside music/. */
  file: string;
  author: string;
  license: string;
  /** Where the piece comes from (its licence is stated there). */
  page: string;
}

export interface Station {
  id: string;
  name: string;
  url: string;
  homepage?: string;
  note?: string;
}

export interface Soundfont {
  name: string;
  file: string;
  author: string;
  license: string;
  page: string;
}

export interface Library {
  tracks: Piece[];
  midi: Piece[];
  soundfont: Soundfont | null;
  streams: Station[];
}

const empty = (): Library => ({ tracks: [], midi: [], soundfont: null, streams: [] });

/** The library; empty if this build has no music (nothing was downloaded, or the dev server answered with a page). */
export async function loadLibrary(): Promise<Library> {
  try {
    const res = await fetch(`${MUSIC_BASE}index.json`);
    if (!res.ok) return empty();
    const json = (await res.json()) as Partial<Library>;
    return {
      tracks: json.tracks ?? [],
      midi: json.midi ?? [],
      soundfont: json.soundfont ?? null,
      streams: json.streams ?? [],
    };
  } catch {
    return empty();
  }
}
