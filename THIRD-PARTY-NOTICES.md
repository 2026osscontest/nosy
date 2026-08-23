# Third-Party Notices

이 프로젝트는 아래 오픈소스 프로젝트의 로직을 참고하거나 포팅했습니다.

## shellrc-doctor

- 저장소: https://github.com/nord342/shellrc-doctor
- 라이선스: MIT License
- 사용 방식: 런타임 의존성으로 호출하지 않습니다. `packages/core/src/adapters/shell-rc.ts`가 이 프로젝트의 셸 rc 파일 진단 아이디어(중복 PATH, 죽은 alias, 존재하지 않는 source, 중복 alias, nvm+asdf/pyenv+asdf 초기화 충돌)를 TypeScript로 새로 구현했습니다 (`docs/ADR.md` ADR-004 참조).

```
MIT License

Copyright (c) 2026 nord342

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
