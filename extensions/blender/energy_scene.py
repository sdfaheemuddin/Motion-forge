"""Build the reusable, illustrative energy-infrastructure scene in Blender."""
import bpy
import json
import math
import os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

CONFIG = {
    'asset_directory': os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'projects', 'pvinsight-blueprint', 'assets'),
    'resolution': (1600, 900),
    'samples': 96,
    'tracker_rows': 5,
    'tracker_rotation_degrees': 9,
    'tracker_axis_height': 1.45,
    'vertical_files': {
        'site': 'Site.png',
        'solar': 'PV.png',
        'bess': 'BESS.png',
        'substation': 'Substation.png',
        'transmission': 'TLine.png',
        'datacenter': 'DataCenter.png',
    },
}
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = CONFIG['samples']
scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = CONFIG['resolution']
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.world.color = (0.26, 0.30, 0.40)
scene.view_settings.view_transform = 'AgX'
groups = {name: [] for name in ['site', 'solar', 'bess', 'substation', 'transmission', 'datacenter']}

def material(name, color, metallic=0.0, roughness=0.45, glow=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if glow:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = glow
    return mat

M = {
    'soil': material('Dark landscaped ground', (0.065, 0.13, 0.14)),
    'edge': material('Site edge', (0.025, 0.055, 0.075), 0.4),
    'road': material('Access roads', (0.13, 0.18, 0.20)),
    'white': material('Warm white equipment', (0.70, 0.80, 0.82), 0.25),
    'steel': material('Galvanized steel', (0.38, 0.48, 0.55), 0.65),
    'dark': material('Graphite steel', (0.025, 0.055, 0.08), 0.50),
    'panel': material('Solar glass', (0.018, 0.09, 0.19), 0.65, 0.24),
    'cell': material('Solar cell lines', (0.15, 0.40, 0.53), 0.5),
    'cyan': material('Energy cyan', (0.005, 0.76, 0.80), 0.25, 0.3, 2),
    'amber': material('Power amber', (0.94, 0.41, 0.08), 0.3),
    'glass': material('Data center glazing', (0.02, 0.17, 0.23), 0.6, 0.22),
}

def box(name, location, size, mat, group, rotation=(0, 0, 0), bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(M[mat])
    obj['asset_vertical'] = group
    if bevel:
        modifier = obj.modifiers.new('Manufactured edge', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 1
        obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    groups[group].append(obj)
    return obj

def bar(name, a, b, radius, mat, group):
    direction = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=radius, depth=direction.length, location=(Vector(a)+Vector(b))/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(M[mat])
    obj['asset_vertical'] = group
    groups[group].append(obj)
    return obj

box('Floating site plinth', (0, 0, -0.38), (28, 17, 0.65), 'edge', 'site', bevel=0.16)
box('Site surface', (0, 0, -0.035), (27.8, 16.8, 0.12), 'soil', 'site')
box('Central access road', (1.3, 0, 0.05), (1.15, 16.3, 0.03), 'road', 'site', bevel=0)
box('Equipment access road', (6.5, 0.3, 0.075), (12, 0.85, 0.03), 'road', 'site', bevel=0)

# Single-axis trackers: each long row shares a rotating torque tube, bearings,
# driven motor pile and intermediate support piles. No fixed-tilt rack legs.
tilt = math.radians(CONFIG['tracker_rotation_degrees'])
axis_height = CONFIG['tracker_axis_height']
for row in range(CONFIG['tracker_rows']):
    y = -5.8 + row*2.5
    box('Continuous tracker torque tube', (-6.7,y,axis_height), (11.05,0.16,0.16), 'steel','solar',(tilt,0,0))
    for x in [-11.8,-8.4,-5.0,-1.6]:
        box('Tracker steel support pile',(x,y,axis_height/2),(0.11,0.17,axis_height),'steel','solar')
        box('Tracker rotating bearing',(x,y,axis_height),(0.24,0.32,0.28),'dark','solar')
    # A central module gap exposes the slew drive and motor housing.
    box('Tracker motor pile',(-6.7,y,0.72),(0.20,0.25,1.44),'steel','solar')
    box('Tracker slew drive',(-6.7,y,axis_height),(0.46,0.45,0.40),'amber','solar')
    box('Tracker drive motor',(-6.7,y-0.40,axis_height),(0.28,0.52,0.27),'dark','solar')
    box('Tracker controller',(-6.7,y-0.24,0.92),(0.28,0.16,0.35),'white','solar')
    for x in [-11.25,-9.55,-7.85,-5.55,-3.85,-2.15]:
        module_z=axis_height+0.16
        box('Tracker PV module',(x,y,module_z),(1.64,2.06,0.075),'panel','solar',(tilt,0,0))
        for dx in [-0.79,-0.40,0,0.40,0.79]:
            box('Tracker module cell line',(x+dx,y,module_z+0.046),(0.012,2.06,0.012),'cell','solar',(tilt,0,0),bevel=0)
        for dy in [-1.0,-0.5,0,0.5,1.0]:
            box('Tracker module cell line',(x,y+dy*math.cos(tilt),module_z+0.046+dy*math.sin(tilt)),(1.64,0.012,0.012),'cell','solar',(tilt,0,0),bevel=0)

# Storage containers, ventilated doors, DC cabinets and power conversion skids.
for y in [-5.8, -3.5]:
    for x in [4.3, 8.8]:
        box('BESS foundation', (x,y,0.12), (3.9,1.75,0.20), 'steel', 'bess')
        box('Battery enclosure', (x,y,1.0), (3.7,1.55,1.7), 'white', 'bess')
        box('Battery teal fascia', (x,y-0.784,1.50), (3.6,0.035,0.19), 'cyan', 'bess')
        for dx in [-1.2, -0.4, 0.4, 1.2]:
            box('Cabinet door', (x+dx,y-0.795,0.85), (0.74,0.025,1.10), 'steel', 'bess', bevel=0.01)
            for z in [0.5,0.6,0.7,0.8]:
                box('Cooling louvre', (x+dx,y-0.812,z), (0.56,0.018,0.025), 'dark', 'bess', bevel=0)
for x in [4.2,8.8]:
    box('Power conversion skid', (x,-1.5,0.5), (2.2,0.65,0.85), 'dark', 'bess')
    box('PCS status strip', (x,-1.836,0.6), (1.8,0.02,0.08), 'cyan', 'bess')

# A deliberately illustrative outdoor substation.
box('Substation pad', (4.6,3.7,0.12), (5.3,5.0,0.18), 'road', 'substation')
for x in [3.3,5.9]:
    box('Power transformer', (x,3.6,1), (1.45,1.6,1.5), 'steel', 'substation')
    for dx in [-0.88,0.88]:
        box('Transformer radiator', (x+dx,3.6,0.95), (0.20,1.6,1.3), 'dark', 'substation')
    for dy in [-0.48,0,0.48]:
        bar('Transformer bushing', (x,3.6+dy,1.75), (x,3.6+dy,2.55), 0.09, 'amber', 'substation')
for y in [1.7,5.7]:
    for x in [2.3,6.9]:
        bar('Gantry column', (x,y,0.1),(x,y,3.7),0.07,'steel','substation')
    bar('Gantry beam', (2.3,y,3.7),(6.9,y,3.7),0.075,'steel','substation')
    for x in [3.2,4.6,6]:
        bar('Bus support insulator', (x,y,2.8),(x,y,3.65),0.055,'amber','substation')
for x in [3.2,4.6,6]:
    bar('Overhead bus', (x,1.7,3.7),(x,5.7,3.7),0.025,'steel','substation')

def tower(x,y,height=6.2):
    for level in range(5):
        z0,z1 = 0.1+level*0.94, 0.1+(level+1)*0.94
        w0,w1 = 0.72*(1-z0/7.2), 0.72*(1-z1/7.2)
        for sign in [-1,1]:
            for side in [-1,1]:
                bar('Tower leg',(x+sign*w0,y+side*w0,z0),(x+sign*w1,y+side*w1,z1),0.035,'steel','transmission')
            bar('Tower lattice',(x-w0,y+sign*w0,z0),(x+w1,y+sign*w1,z1),0.020,'steel','transmission')
            bar('Tower lattice',(x+w0,y+sign*w0,z0),(x-w1,y+sign*w1,z1),0.020,'steel','transmission')
    bar('Tower peak',(x,y,4.7),(x,y,6.3),0.05,'steel','transmission')
    for z,width in [(4.5,1.55),(5.45,1.25)]:
        bar('Transmission crossarm',(x-width,y,z),(x+width,y,z),0.055,'steel','transmission')
        for sign in [-1,1]:
            bar('Tower crossarm brace',(x,y,z-0.6),(x+sign*width,y,z),0.03,'steel','transmission')
            bar('Suspension insulator',(x+sign*width,y,z),(x+sign*width,y,z-0.43),0.06,'amber','transmission')
for x,y in [(-10,6.1),(-3.0,6.1)]:
    tower(x,y)
for z,offset in [(4.07,1.55),(5.02,1.25)]:
    for sign in [-1,1]:
        for i in range(12):
            a,b=i/12,(i+1)/12
            pa=(-10+sign*offset+7*a,6.1,z-0.45*math.sin(math.pi*a))
            pb=(-10+sign*offset+7*b,6.1,z-0.45*math.sin(math.pi*b))
            bar('Transmission conductor',pa,pb,0.016,'dark','transmission')

# Data center shell and its external electrical/cooling infrastructure.
box('Data center platform',(10.1,4.4,0.14),(4.8,6.0,0.23),'road','datacenter')
box('Data center building',(10.1,4.45,1.62),(4.3,5.4,2.8),'white','datacenter',bevel=0.08)
box('Dark service elevation',(10.1,1.73,1.6),(4.1,0.06,2.45),'glass','datacenter')
for x in [8.5,9.05,9.6,10.15,10.7,11.25,11.8]:
    box('Facade mullion',(x,1.68,1.6),(0.06,0.10,2.5),'steel','datacenter')
box('Data center roof trim',(10.1,4.45,3.08),(4.5,5.6,0.16),'dark','datacenter')
box('Powered facade strip',(10.1,1.60,2.87),(4.25,0.04,0.08),'cyan','datacenter')
for x in [9.0,11.0]:
    for y in [3.1,5.5]:
        box('Rooftop cooling unit',(x,y,3.42),(1.25,1.55,0.55),'steel','datacenter')
        for dy in [-0.4,0.4]:
            bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=0.35,depth=0.03,location=(x,y+dy,3.71))
            fan=bpy.context.object
            fan.data.materials.append(M['dark'])
            fan['asset_vertical']='datacenter'
            groups['datacenter'].append(fan)

# Orthographic camera preserves exact registration between drawing and solids.
bpy.ops.object.camera_add(location=(30,-40,32))
camera=bpy.context.object
target=Vector((0.4,0.4,2.0))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=39.5
scene.camera=camera
for location, energy, size in [((2,-10,25),4200,18),((-15,5,15),2800,12),((12,14,20),3800,10)]:
    bpy.ops.object.light_add(type='AREA',location=location)
    light=bpy.context.object
    light.data.energy=energy
    light.data.shape='DISK'
    light.data.size=size
    light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='SUN',location=(0,0,15))
bpy.context.object.data.energy=1.8
bpy.context.object.rotation_euler=(0.35,-0.4,-0.4)

os.makedirs(CONFIG['asset_directory'],exist_ok=True)
bpy.context.view_layer.update()
def project(point):
    uv=world_to_camera_view(scene,camera,Vector(point))
    return [round(uv.x*1600,2),round((1-uv.y)*900,2)]

# Export true geometry edges for the progressive CAD drawing animation.
wire={}
for name, objects in groups.items():
    edges=[]
    for obj in objects:
        for edge in obj.data.edges:
            points=[project(obj.matrix_world @ obj.data.vertices[i].co) for i in edge.vertices]
            edges.append(points)
    wire[name]=edges
route=[(-10,-6.5,0.15),(-1,-6.5,0.15),(1,-5.5,0.15),(8.8,-5.5,0.15),(8.8,0.2,0.15),(1.3,0.2,0.15),(1.3,5.9,0.15),(-10,5.9,0.15),(-3,5.9,0.15),(4.6,5.9,0.15),(7.7,5.9,0.15),(7.7,1.1,0.15),(10.1,1.1,0.15)]
with open(os.path.join(CONFIG['asset_directory'],'geometry.json'),'w') as stream:
    json.dump({'wire':wire,'route':[project(p) for p in route]},stream)

# Render each vertical independently over transparency. Camera registration is
# shared so the compositor can assemble the scene from reusable PNG layers.
order=list(groups)
vertical_directory=os.path.join(CONFIG['asset_directory'],'verticals')
os.makedirs(vertical_directory,exist_ok=True)
placement_manifest=os.path.join(vertical_directory,'placements.json')
if os.path.isfile(placement_manifest):
    # Fresh full-canvas renders invalidate the preceding cropped placements.
    os.remove(placement_manifest)
for name in order:
    for group_name in order:
        for obj in groups[group_name]:
            obj.hide_render=group_name!=name
    scene.render.filepath=os.path.join(vertical_directory,CONFIG['vertical_files'][name])
    print(f'Rendering isolated vertical: {name}',flush=True)
    bpy.ops.render.render(write_still=True)
for objects in groups.values():
    for obj in objects:
        obj.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(CONFIG['asset_directory'],'PVI_Energy_Scene.blend'))
