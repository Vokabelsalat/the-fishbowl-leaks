# MindAR target file

`exhibition.mind` contains 19 targets: the white-background PNG images in this folder in exhibition ID order (`1-finding-frida-white.png` through `18-earth-fortunes-white.png`), where target index `N` belongs to the artifact with exhibition ID `N + 1`, then `16-fishbowl-leaks-black.png` at index 18, the dark target on the poster and tutorial sheet, which opens The Fishbowl Leaks.

Regenerate the images with `npm run targets:export`, recompile the bundle with `npm run targets:compile`, and check the result with `npm run targets:verify`. See the repository README for details.
