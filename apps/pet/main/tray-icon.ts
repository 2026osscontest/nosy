// 이 파일은 assets/tray/generator/generate.mjs가 생성한다. 직접 고치지 말 것.
// 아이콘을 파일 경로가 아니라 data URL로 심는 이유: main 번들은 out/main/에서 돌기 때문에
// assets/를 상대 경로로 찾으면 dev와 패키징에서 깊이가 달라 조용히 깨진다.
// 16×16 + 32×32 템플릿 PNG는 합쳐서 300바이트 미만이라 소스에 그대로 넣는 편이 안전하다.

export const TRAY_ICON_1X = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAQElEQVR4nGNgoDH4P2AG/EfDJGskVhxDEUVqKDKAFH9iVYsu+J+AHEaYkOqCgTeANAli1VBsAEwB2SkRmwaCGgFs0yvVOMr7fQAAAABJRU5ErkJggg=='
export const TRAY_ICON_2X = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAX0lEQVR4nO3WwQ4AIAQGYO//0rp0NTKi/DanFl8HFRHCH7wTgDkAVvI/wGmDcFAZIOoE7joAlAGyxslctz1AWrfuU8e0PcAbAADwzj0QDXnvLQBAKjDvT2htkN7wCmABItCvUUIwFAkAAAAASUVORK5CYII='
