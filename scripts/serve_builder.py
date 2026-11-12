"""Development entry point for the compiled local builder."""
from pathlib import Path
import argparse
import os
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'app'))
import uvicorn
from motion_forge.controllers.api import create_app
parser=argparse.ArgumentParser()
parser.add_argument('--host',default='127.0.0.1')
parser.add_argument('--port',type=int,default=int(os.environ.get('PORT','8765')))
parser.add_argument('--strictPort',action='store_true')
args=parser.parse_args()
uvicorn.run(create_app(ROOT),host=args.host,port=args.port)
