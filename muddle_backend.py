from bottle import *
import json
import os
import hashlib
import shutil
import sqlite3
from operator import itemgetter

# allow for big posts
BaseRequest.MEMFILE_MAX = 1024 * 1024

# serve up our static files
# example: http://localhost:8080/static/html/page.html
@route("/static/<path:path>")
def callback(path):
	return static_file(path, root = "" )

@post("/save_entities/")
def save_entities():
	ents = json.loads(request.forms["save_list"])
	master = json.loads(request.forms["master"])
	master_id = None
	if (master):
		master_id = master["id"]
	
	# handle any files sent down
	for file_id in request.files.keys():
		hasher = hashlib.md5()
		
		path_for_asset = "assets/" + file_id
		file_obj = request.files[file_id]
		filename = request.files[file_id].filename
		hasher.update(file_obj.file.read())
		file_hash = hasher.hexdigest()
		
		deleted = False
		file_already_present = os.path.exists(path_for_asset)
		
		# check if a file has already been saved for this id
		if file_already_present:
			hasher = hashlib.md5()
			# assuming only one file in directory...
			existing_filename = os.listdir(path_for_asset)[0]
			existing_file = open(path_for_asset + "/" + existing_filename, "rb")
			# get hash for existing file
			hasher.update(existing_file.read())
			existing_hash = hasher.hexdigest()
			existing_file.close()
			
			# if file hashes do not match or filenames do not match, delete existing file
			if existing_filename != filename or existing_hash != file_hash:
				os.unlink(path_for_asset + "/" + existing_filename)
				deleted = True
			
		
		# save the file
		if deleted == True or not file_already_present:
			if not os.path.exists(path_for_asset):
				os.makedirs(path_for_asset)
			file_obj.file.seek(0)
			file_obj.save(path_for_asset + "/" + filename, overwrite = True)
		
	
	# handle entities
	# unpack the nested entities into flat list
	flat_list = []
	top_level_ids = []
	for ent in ents:
		top_level_ids.append(ent["id"])
		thing = writer.unpack_children(ent)
		flat_list += thing
	
	# save to db
	if len(flat_list) > 0:
		writer.write_ents(flat_list, top_level_ids, master_id)
	else:
		print "got nothing to save, doing nothing"


@post("/delete_entities/")
def delete_entities():
	print "delete entities called"
	#print request.json
	
	if type(request.json) == list:
		list_to_delete = request.json
	elif type(request.json) == dict:
		# what?
		list_to_delete = []
	else:
		print "bad json was sent to delete_entities(), stopping"
		return
	
	# get children to delete
	flat_list = []
	for ent in list_to_delete:
		thing = writer.unpack_children(ent)
		flat_list += thing
	
	# delete from db
	writer.clear_ents(flat_list)
	
	# if any of our deleted props contained files, delete files from assets folder
	for itm in flat_list:
		if "is_file" in itm.keys():
			if itm["is_file"]:
				file_id = itm["id"]
				dir_path = "assets/" + file_id
				if os.path.exists(dir_path):
					shutil.rmtree(dir_path)

@post("/load_master/")
def load_master():
	print "load master called"
	
	master_id = request.json["master_id"]
	#print master_id
	if not master_id:
		master_id = None
	
	all = fetcher.get_ents(master_id)
	
	return json.dumps(all)

@get("/load_all_masters/")
def load_all_masters():
	masters = fetcher.get_all_masters()
	return json.dumps(masters)

# note this is a route and not a post/get...
@route("/export_master/")
def export_master():
	
	if "master_id" in request.query.keys():
		master_id = request.query["master_id"]
		if master_id == "null":
			master_id = None
	else:
		master_id = None
	
	the_data = fetcher.get_ents(master_id)
	
	# path stuff
	name = None
	if not master_id:
		name = "default"
	else:
		name = master_id
	
	export_path = "exports/" + name
	
	# delete exports directory if it already exists
	if os.path.exists(export_path):
		shutil.rmtree(export_path)
		
	# same deal with the export zip
	if os.path.exists(export_path + ".zip") and os.path.isfile(export_path + ".zip"):
		os.unlink(export_path + ".zip")
	
	# create empty export dir
	os.makedirs(export_path)
	
	# write out the json
	export_file = open(export_path + "/data.json", "w")
	export_file.write(json.dumps(the_data))
	export_file.close()
	
	# grab our assets
	# put something here
	
	# zip it all up
	shutil.make_archive(export_path, "zip", export_path)
	
	return static_file(export_path + ".zip", root = "", download = export_path + ".zip")
	

class Fetcher:
	def __init__(self):
		self.db = sqlite3.connect("db/entities.s3db")
		if self.db:
			print("got db")
		else: 
			print("did not get db")
		# returns utf-8 instead of unicode
		self.db.text_factory = str
		self.db.row_factory = sqlite3.Row
		self.cursor = self.db.cursor()
	
	def dictify_row(self, row):
		d = {}
		for key in row.keys():
			d[key] = row[key]
		return d
	
	def get_ent_children(self, parent_id):
		q = []
		children = []
		child = None
		dict = {}
		sql = "select * from obj where parent_id = ?"
		self.cursor.execute(sql, (parent_id,))
		rows = self.cursor.fetchall()
		
		if len(rows) > 0:
			for row in rows:
				dict = self.dictify_row(row)
				children.append(dict)
			for child in children:
				q += self.get_ent_children(child["id"])
		
		return q + children
				
	
	def get_ents(self, master_id):
		sql = "select * from obj where top_level = 1 and master_id is ?;"
		
		db_master_id = None
		if master_id == None:
			sql = "select * from obj where top_level = 1 and master_level = 0 and master_id is null;"
			self.cursor.execute(sql)
		else:
			db_master_id = master_id
			self.cursor.execute(sql, (db_master_id,))
		rows = self.cursor.fetchall()
		ents = []
		q = []
		temp_ent = {}
		
		# make dict
		for row in rows:
			#print "a row"
			temp_ent = {}
			for key in row.keys():
				temp_ent[key] = row[key]
			ents.append(temp_ent)
		
		for ent in ents:
			q += self.get_ent_children(ent["id"])
		
		ents += q
		
		return ents
		
	def get_all_masters(self):
		sql = "select * from obj where master_level = 1"
		self.cursor.execute(sql)
		rows = self.cursor.fetchall()
		ents = []
		q = []
		temp_ent = {}
		
		# make dict
		for row in rows:
			temp_ent = {}
			for key in row.keys():
				temp_ent[key] = row[key]
			ents.append(temp_ent)
		
		for ent in ents:
			q += self.get_ent_children(ent["id"])
		
		ents += q
		
		return ents
		

class Writer:
	def __init__(self):
		self.db = sqlite3.connect("db/entities.s3db")
		self.db.text_factory = str
		self.cursor = self.db.cursor()
		
	def unpack_children(self, ent):
		if "_children" not in ent.keys():
			print "passed something to unpack_children() with no _children"
			return
		
		children = ent["_children"]
		q = []
		# if we're on a top-level ent
		if ent["top_level"] == True and ent["master_level"] == False:
			cont = {"id": ent["id"], "parent_id": None, "master_level": ent["master_level"], "top_level": ent["top_level"], "edit_sort": ent["edit_sort"], "bound_id": ent["bound_id"], "type": ent["type"], "name": None}
			q.append(cont)
		elif ent["master_level"] == True:
			cont = {"id": ent["id"], "parent_id": None, "master_level": ent["master_level"], "top_level": ent["top_level"], "edit_sort": ent["edit_sort"], "bound_id": ent["bound_id"], "type": None, "name": None}
			q.append(cont)
		for child in children:
			# if this is not an prop
			if "_children" in child.keys():
				# get the container
				bound_list_type = None
				if "bound_list_type" in child.keys():
					bound_list_type = child["bound_list_type"]
				cont = {"id": child["id"], "parent_id": child["parent_id"], "top_level": child["top_level"], "master_level": child["master_level"], "edit_sort": child["edit_sort"], "bound_list_type": bound_list_type, "bound_id": child["bound_id"], "type": child["type"], "name": child["name"]}
				q.append(cont)
				# now unpack the children
				if len(child["_children"]) > 0:
					q += self.unpack_children(child)
			# if an prop, just append
			else:
				q.append(child)
		
		return q
		
	def write_ents(self, list, top_level_ids, master_id):
		#prepare to write
		insert_list = []
		clear_list = []
		fields = ("id", "master_id", "type", "name", "parent_id", "master_level", "top_level", "edit_only", "edit_sort", "is_file", "bound_list_type", "bound_id", "prop_type", "num_val", "str_val", "bool_val")
		values = None
		
		# first delete existing rows we're trying to save
		for ent_id in top_level_ids:
			clear_list += [{"id": ent_id}]
			clear_list += fetcher.get_ent_children(ent_id)
		self.clear_ents(clear_list)
		
		nl = sorted(list, key = itemgetter("id"))
		#for itm in nl:
			#print itm["id"]
		
		for x in list:
			# properties everything will have
			id = x["id"]
			_type = x["type"] # so as not to override python's type()
			name = x["name"]
			parent_id = x["parent_id"]
			master_level = x["master_level"]
			top_level = x["top_level"]
			edit_sort = x["edit_sort"]
			bound_id = x["bound_id"]
			
			# handle the master_id
			if (master_level == False):
				write_master_id = master_id
			else:
				write_master_id = None
			
			# properties not everything will have
			num_val = None
			str_val = None
			bool_val = None
			prop_type = None
			edit_only = None
			is_file = None
			bound_list_type = None
			if "_val" in x.keys():
				prop_type = x["prop_type"]
				edit_only = x["edit_only"]
				is_file = x["is_file"]
				
				if type(x["_val"]) is int or type(x["_val"]) is float:
					num_val = x["_val"]
				elif type(x["_val"]) is str or type(x["_val"]) is unicode:
					str_val = x["_val"]
				elif type(x["_val"]) is bool:
					bool_val = x["_val"]
			
			if "bound_list_type" in x.keys():
				bound_list_type = x["bound_list_type"]
			
			values = (id, write_master_id, _type, name, parent_id, master_level, top_level, edit_only, edit_sort, is_file, bound_list_type, bound_id, prop_type, num_val, str_val, bool_val)
			insert_list.append(values)
		
		sql = "insert into obj (" +  ",".join(fields) + ") values(" + ",".join("?" * len(values)) + ");"
		self.cursor.executemany(sql, insert_list)
		self.db.commit()
	
	
	def clear_ents(self, list):
		id_list = []
		sql = "delete from obj where id = ?"
		
		for x in list:
			id_list.append((x["id"],))
		
		self.cursor.executemany(sql, id_list)
		self.db.commit()


fetcher = Fetcher()
writer = Writer()

# currently set up to test
run(host = "0.0.0.0", port = 8081, debug = True)