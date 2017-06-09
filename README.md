# Sample App

To try this out, run the muddle_backend.py script and point your browser at http://localhost:8081/static/html/sample_app.html

The core files are muddle.js and muddle_backend.py, everything else in here is just a very simple example implementation of the kind of app that can be made with [the muddle AngularJS module](https://github.com/bp-bp/muddle). Look at sample_app.html to see how to use the directives to define a data model in the html, check out the directive definitions and the definitions of the Prop, Prop_Cont, and List_Prop objects in muddle.js to see how they work. Some sample data is already in the db.

From [muddle](https://github.com/bp-bp/muddle)'s readme:

>This is a system for creating quick and dirty database apps from scratch. It consists of a simple bottle.py-based python backend, an sqlite3 database with one table, and an AngularJS module containing a couple of services and a bunch of directives. Add the directives to your html and they'll automatically define and build your data model right there in the markup, at the same time as you're creating your data-entry forms. When the directives compile, and their controllers execute, a data model is dynamically created based on the hierarchical structure of the view, and the "muddle_backend" service allows you to save/load whatever arbitrary data structures you've created without having to touch the backend code or monkey with the db. There is (or will be, soon) a sample app that demonstrates how this all works.
>
>The name "muddle" is a little pun on the term "data model" -- the joke is the way that this project wildly and recklessly disregards/muddles up the whole model-view-controller concept. Obviously, this is a very silly project that probably doesn't belong in any production environment, but I've found it pretty useful nonetheless. It's great for rapid prototyping or quickly standing up an internal tool.
