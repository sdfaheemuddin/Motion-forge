from .encoder import run_ffmpeg
from ...utils.paths import project_path

def mix_audio(project, video_path, output_path, log_path):
    arguments=['-i',video_path]
    filters=[]
    tracks=project.timeline.get('audio',[])
    for index,track in enumerate(tracks,1):
        source=project_path(project.root,project.assets[track['asset']]['source'])
        arguments += ['-ss',track.get('trimStart',0),'-t',track['duration'],'-i',source]
        chain=f'[{index}:a]asetpts=PTS-STARTPTS,volume={track.get("volume",1)}'
        if track.get('fadeIn',0):
            chain+=f',afade=t=in:st=0:d={track["fadeIn"]}'
        if track.get('fadeOut',0):
            start=max(0,track['duration']-track['fadeOut'])
            chain+=f',afade=t=out:st={start}:d={track["fadeOut"]}'
        chain+=f',adelay={round(track["start"]*1000)}:all=1[a{index}]'
        filters.append(chain)
    inputs=''.join(f'[a{index}]' for index in range(1,len(tracks)+1))
    filters.append(f'{inputs}amix=inputs={len(tracks)}:normalize=0,apad,atrim=duration={project.duration}[audio]')
    arguments += ['-filter_complex',';'.join(filters),'-map','0:v:0','-map','[audio]','-c:v','copy','-c:a','aac',
                  '-b:a',project.export.get('audio',{}).get('bitrate','192k'),'-t',project.duration,
                  '-movflags','+faststart',output_path]
    run_ffmpeg(arguments,log_path)
