"""Cuts a trailer from the recorded clips: python3 build.py [teaser|extended]"""
import os
import subprocess
import sys

DIR = os.path.dirname(os.path.abspath(__file__)) + "/"
S = DIR + "work/"
FF = DIR + "node_modules/ffmpeg-static/ffmpeg"
A = DIR + "../../public/audio/"
FPS = 30
HARP, DRIFT = A + "threads-of-the-tide.m4a", A + "pressure-drift.m4a"

# Crop origins in the 2880x1620 masters: 1920x1080 crops are 1.5x punch-ins, 1440x810 crops 2x.
HOOK, MERMAID, CAN, KRAKEN = (960, 27), (394, 464), (624, 432), (278, 464)
SHRIMP_SCHOOL, OCTOPUS_PAIR, EDITOR_KRAKEN = (0, 245), (789, 27), (408, 252)

# Shots: (duration, kind, clip, source in, framing, speed). Kinds: wide, punch (1.5x), close (2x), phone, end, poster.
# Captions: (overlay, in, out) on the trailer's own timeline; they may span several shots.
# Music: (track, source in, trailer in, length, fade in, fade out).
OPENING = [
    (6.8, "wide", "wall-c10", 26.0, None, 1),
    (3.0, "punch", "wall-c10", 12.0, HOOK, 1),
]
JOURNEY = [
    (3.0, "phone", "phone-scan1", 0.6, None, 1),
    (9.0, "phone", "phone-scan1", 5.3, None, 1),
    (3.0, "phone", "phone-scan2", 2.5, None, 1),
    (3.0, "phone", "phone-scan3", 3.0, None, 1),
    (3.0, "phone", "phone-scan4", 2.5, None, 1),
]

CUTS = {
    "teaser": {
        "out": "fishbowl-leaks-trailer.mp4",
        "shots": OPENING + [(3.0, "punch", "wall-c10", 34.5, MERMAID, 1)] + JOURNEY + [
            (6.0, "phone", "phone-scan4", 14.0, None, 1),
            (3.0, "phone", "phone-scan4", 37.0, None, 1),
            (7.0, "wide", "wall-arrival", 2.3, None, 1),
            (4.5, "wide", "wall-c50", 23.8, None, 1),
            (4.5, "wide", "wall-c50", 31.3, None, 1),
            (4.0, "punch", "wall-c50", 63.0, CAN, 1),
            (4.0, "wide", "wall-c110", 0.5, None, 1),
            (5.0, "punch", "wall-c110", 10.0, KRAKEN, 1),
            (4.0, "wide", "wall-c110", 27.0, None, 1),
            (4.2, "wide", "wall-c110", 41.5, None, 1),
            (5.05, "wide", "wall-c110", 48.0, None, 1),
            (8.95, "end", "wall-c110", 49.0, None, 1),
        ],
        "captions": [
            ("cap-classify", 0.8, 6.2), ("cap-scan", 13.3, 24.4), ("cap-gather", 25.0, 33.4),
            ("cap-grow", 34.1, 39.5), ("cap-release", 39.9, 42.6), ("cap-order", 50.2, 54.0),
            ("cap-free", 63.1, 66.5), ("cap-leak", 80.4, 84.75),
        ],
        "music": [
            (HARP, 0, 0, 50.5, 0, 3),
            (DRIFT, 95, 47, 35.5, 3, 3),
            (HARP, 178, 80, 14, 0.8, 0),
        ],
    },
    "extended": {
        "out": "fishbowl-leaks-trailer-extended.mp4",
        "shots": OPENING + JOURNEY[:1] + JOURNEY[1:] + [
            (5.0, "phone", "phone-scan4", 14.0, None, 1),
            (3.0, "phone", "phone-scan4", 37.0, None, 1),
            (7.0, "wide", "wall-arrival", 2.3, None, 1),
            # How the specimens are made.
            (6.0, "wide", "page-palettes", 0.8, None, 1.5),
            (6.0, "wide", "page-editor", 1.0, None, 1.6),
            (3.0, "punch", "page-editor", 23.6, EDITOR_KRAKEN, 1),
            (6.0, "wide", "page-particles", 1.0, None, 1.5),
            # Life in the tank.
            (4.5, "close", "tank-50b", 99.5, SHRIMP_SCHOOL, 1),
            (3.0, "close", "tank-50b", 2.0, OCTOPUS_PAIR, 1),
            (2.5, "close", "tank-50b", 8.0, OCTOPUS_PAIR, 1),
            (4.0, "wide", "wall-c50", 23.8, None, 1),
            (3.5, "wide", "wall-c50", 31.8, None, 1),
            (3.0, "punch", "wall-c50", 63.5, CAN, 1),
            (4.0, "wide", "wall-c110", 0.5, None, 1),
            (4.0, "punch", "wall-c110", 10.0, KRAKEN, 1),
            (3.0, "wide", "wall-c110", 27.5, None, 1),
            (8.5, "wide", "tank-110-orbit", 1.5, None, 2),
            (12.5, "poster", "page-poster", 0.5, None, 1),
        ],
        "captions": [
            ("cap-classify", 0.8, 6.2), ("cap-scan", 10.3, 21.4), ("cap-gather", 22.0, 30.4),
            ("cap-grow", 31.1, 35.5), ("cap-release", 35.9, 38.6), ("cap-unique", 46.3, 51.4),
            ("cap-editor", 52.3, 60.4), ("cap-constellation", 61.3, 66.4), ("cap-tanklife", 67.3, 76.4),
            ("cap-order", 77.2, 80.5), ("cap-free", 88.1, 91.0), ("cap-leak", 102.6, 106.5),
        ],
        "music": [
            (HARP, 0, 0, 67.8, 0, 3),
            (DRIFT, 95, 65.3, 43, 3, 2.5),
            (HARP, 179.5, 106.8, 12.5, 0.6, 0),
        ],
    },
}


def run(args):
    result = subprocess.run([FF, "-y", "-loglevel", "error", *args])
    if result.returncode:
        sys.exit(result.returncode)


def build(name):
    cut = CUTS[name]
    work = f"{S}seg-{name}/"
    os.makedirs(work, exist_ok=True)
    segments, t0 = [], 0.0
    total = round(sum(shot[0] for shot in cut["shots"]) * FPS) / FPS
    for i, (length, kind, clip, src, framing, speed) in enumerate(cut["shots"]):
        frames = round(length * FPS)
        dur = frames / FPS
        t1 = t0 + dur
        out = f"{work}{i:02d}.mp4"
        segments.append(out)
        inputs = ["-ss", f"{src:.3f}", "-t", f"{dur * speed + 0.3:.3f}", "-i", f"{S}clips/{clip}.mp4"]
        retime = f"setpts=PTS/{speed}," if speed != 1 else ""
        if kind in ("wide", "poster"):
            f = f"[0]{retime}scale=1920:1080:flags=lanczos,setsar=1[v]"
        elif kind == "punch":
            f = f"[0]{retime}crop=1920:1080:{framing[0]}:{framing[1]},setsar=1[v]"
        elif kind == "close":
            f = f"[0]{retime}crop=1440:810:{framing[0]}:{framing[1]},scale=1920:1080:flags=lanczos,setsar=1[v]"
        elif kind == "phone":
            inputs += ["-i", S + "ov/phone-under.png", "-i", S + "ov/phone-mask.png"]
            f = ("[0]split[a][b];"
                 "[a]scale=1920:-2,crop=1920:1080,boxblur=40:2,eq=brightness=-0.16:saturation=0.8[bg];"
                 "[bg][1]overlay=0:0[bg2];"
                 "[b]scale=444:960:flags=lanczos,format=rgba[ph];[2]format=gray[m];[ph][m]alphamerge[phm];"
                 "[bg2][phm]overlay=480:60,setsar=1[v]")
        elif kind == "end":
            inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", S + "ov/endcard.png"]
            f = ("[0]scale=1920:1080:flags=lanczos,gblur=sigma=5[bg];"
                 "[1]format=rgba,fade=t=in:st=0.3:d=1.2:alpha=1[ec];[bg][ec]overlay=0:0,setsar=1[v]")
        # Every caption that overlaps this shot, faded only where it really begins or ends.
        for cap, cin, cout in cut["captions"]:
            if cout <= t0 or cin >= t1:
                continue
            index = sum(1 for arg in inputs if arg == "-i")
            inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", f"{S}ov/{cap}.png"]
            fades = []
            if cin > t0:
                fades.append(f"fade=t=in:st={cin - t0:.3f}:d=0.5:alpha=1")
            if cout < t1:
                fades.append(f"fade=t=out:st={cout - t0 - 0.5:.3f}:d=0.5:alpha=1")
            f = f.replace("[v]", "[pre]") + f";[{index}]format=rgba,{','.join(fades) or 'null'}[cap];[pre][cap]overlay=0:0[v]"
        if i == 0:
            f = f.replace("[v]", "[pre]") + ";[pre]fade=t=in:st=0:d=1.2[v]"
        if i == len(cut["shots"]) - 1:
            f = f.replace("[v]", "[pre]") + f";[pre]fade=t=out:st={dur - 1.6:.3f}:d=1.6[v]"
        run([*inputs, "-filter_complex", f, "-map", "[v]", "-frames:v", str(frames), "-r", str(FPS),
             "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", out])
        print(f"{i:02d} {t0:6.2f}-{t1:6.2f} {kind:6} {clip}")
        t0 = t1

    with open(work + "list.txt", "w") as fh:
        fh.write("".join(f"file '{segment}'\n" for segment in segments))
    run(["-f", "concat", "-safe", "0", "-i", work + "list.txt", "-c", "copy", work + "video.mp4"])

    # The harp carries the visitor's journey, the drones the leaking tank, the harp's last phrase the ending.
    sources = sorted({track for track, *_ in cut["music"]})
    inputs = [arg for track in sources for arg in ("-i", track)]
    parts = []
    for n, (track, src, at, length, fade_in, fade_out) in enumerate(cut["music"]):
        chain = f"[{sources.index(track)}]atrim={src}:{src + length},asetpts=PTS-STARTPTS"
        if fade_in:
            chain += f",afade=t=in:d={fade_in}"
        if fade_out:
            chain += f",afade=t=out:st={length - fade_out}:d={fade_out}"
        delay = int(at * 1000)
        parts.append(f"{chain},adelay={delay}|{delay}[m{n}]")
    mix = "".join(f"[m{n}]" for n in range(len(cut["music"])))
    audio = (";".join(parts) + f";{mix}amix=inputs={len(cut['music'])}:normalize=0:duration=longest,"
             f"apad,atrim=0:{total},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo[a]")
    run([*inputs, "-filter_complex", audio, "-map", "[a]", "-c:a", "pcm_s16le", work + "audio.wav"])

    out = S + cut["out"]
    run(["-i", work + "video.mp4", "-i", work + "audio.wav", "-map", "0:v", "-map", "1:a",
         "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
         "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
         "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", out])
    print("done", out, f"{total:.2f}s")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "extended")
