#!/bin/zsh
# usage: makecam.sh <target.png> <artwork.jpg> <out.mjpeg>
FF=${0:a:h}/node_modules/ffmpeg-static/ffmpeg
$FF -y -loglevel error -f lavfi -i "color=c=0x2a2c30:s=1000x1500:r=30:d=12" -i "$2" -i "$1" -filter_complex "\
[0]geq=r='40+22*exp(-((X-500)^2+(Y-800)^2)/300000)':g='42+22*exp(-((X-500)^2+(Y-800)^2)/300000)':b='46+22*exp(-((X-500)^2+(Y-800)^2)/300000)'[bg];\
[1]scale=760:-1[art];[2]scale=-1:520[tgt];\
[bg][art]overlay=x=120:y=60[a];[a][tgt]overlay=x=(W-w)/2+20:y=560[b];\
[b]crop=720:1280:x='140+22*sin(t*0.9)+7*sin(t*2.3)':y='110+16*sin(t*0.7+1)+6*sin(t*1.9)',format=yuvj420p" -q:v 3 -f mjpeg "$3"
