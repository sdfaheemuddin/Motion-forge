import argparse
import json
import sys
from .. import load_project
from ..services.preview_service import PreviewService
from ..services.render_service import RenderService
from ..infrastructure.ffmpeg.encoder import find_ffmpeg
from ..infrastructure.font_resolver import resolve_system_font
from ..utils.errors import MotionForgeError
from ..utils.logging import configure_logging

def main(argv=None):
    parser=argparse.ArgumentParser(prog='motion-forge',description='Compose videos from JSON projects.')
    parser.add_argument('--verbose',action='store_true')
    commands=parser.add_subparsers(dest='command',required=True)
    for name in ('validate','preview','render'):
        command=commands.add_parser(name)
        command.add_argument('project',help='Path to project.json')
        if name in ('preview','render'):
            command.add_argument('--output',help='Optional output file path')
        if name=='preview':
            command.add_argument('--time',type=float,default=0)
    commands.add_parser('doctor',help='Check FFmpeg and system font availability')
    serve=commands.add_parser('serve',help='Start the optional local HTTP API')
    serve.add_argument('--host',default='127.0.0.1')
    serve.add_argument('--port',type=int,default=8765)
    serve.add_argument('--root',default='.')
    ui=commands.add_parser('ui',help='Open the single-user video builder')
    ui.add_argument('--host',default='127.0.0.1')
    ui.add_argument('--port',type=int,default=8765)
    ui.add_argument('--root',default='.')
    ui.add_argument('--no-browser',action='store_true')
    args=parser.parse_args(argv)
    configure_logging(args.verbose)
    try:
        if args.command=='doctor':
            print(json.dumps({'ffmpeg':find_ffmpeg(),'font':resolve_system_font()},indent=2))
        elif args.command in ('serve','ui'):
            try:
                import uvicorn
                from .api import create_app
            except ImportError as error:
                raise MotionForgeError('HTTP API dependencies are missing. Run: python -m pip install ".[api]"') from error
            if args.command=='ui' and not args.no_browser:
                import threading
                import webbrowser
                timer=threading.Timer(1.2,lambda:webbrowser.open(f'http://{args.host}:{args.port}/'))
                timer.daemon=True;timer.start()
            uvicorn.run(create_app(args.root),host=args.host,port=args.port)
        else:
            project=load_project(args.project)
            if args.command=='validate':
                result={'valid':True,'project':project.document['id'],'frames':project.frame_count}
            elif args.command=='preview':
                result={'preview':str(PreviewService().preview(project,args.time,args.output))}
            else:
                result=RenderService().render(project,args.output)
            print(json.dumps(result,indent=2))
        return 0
    except (MotionForgeError,OSError,ValueError) as error:
        print(str(error),file=sys.stderr)
        return 1

if __name__=='__main__':
    raise SystemExit(main())
