# MindAR target file

`exhibition.mind` contains all 18 targets, compiled from the white-background PNG images in this folder in exhibition ID order (`1-finding-frida-white.png` through `18-earth-fortunes-white.png`). Target index `N` belongs to the artifact with exhibition ID `N + 1`.

Regenerate the images with `npm run targets:export`, recompile the bundle with `npm run targets:compile`, and check the result with `npm run targets:verify`. See the repository README for details.
