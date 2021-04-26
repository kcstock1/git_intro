const express = require('express');
const app = express();
app.enable('trust proxy');

const {Datastore} = require('@google-cloud/datastore');
const bodyParser = require('body-parser');
const e = require('express');
//const ds = require('./datastore');
const datastore = new Datastore();

const SLIP = "Slip";
const BOAT = "Boat";
const LOAD = "Load";

const router = express.Router();

app.use(bodyParser.json());

function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

/* ------------- Begin Lodging Model Functions ------------- */
function post_boat(name, type, length){
    var key = datastore.key(BOAT);
    var loads = [];
	var new_boat = {"name": name, "type": type, "length": length,"loads":loads};   
    return datastore.save({"key":key, "data":new_boat}).then(() => {new_boat.id = key.id; return new_boat});
}

async function post_load(volume, content){
    var key = datastore.key(LOAD);

    //Adapted from https://stackoverflow.com/questions/1531093/how-do-i-get-the-current-date-in-javascript
    var creation_date = new Date();
    var dd = String(creation_date.getDate()).padStart(2, '0');
    var mm = String(creation_date.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = creation_date.getFullYear();  
    creation_date = mm + '/' + dd + '/' + yyyy;
    console.log(creation_date);
	var new_load = {"volume": volume, "content": content,"creation_date":creation_date};   
    //return datastore.save({"key":key, "data":new_load}).then(() => {return key});
    await datastore.save({"key":key, "data":new_load});
    new_load.id = key.id;
    return new_load;
}


function get_boat(id,req){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    const q = datastore.createQuery(BOAT).filter('__key__', '=', key); 
    var fullUrl = req.protocol + '://' + req.get('host')    
    //console.log(datastore.runQuery(q));
    results = datastore.runQuery(q).then( (entities) => {
        entities[0][0].loads.forEach(element => {
            element.self = fullUrl + '/loads/' + element.id;
        });
        entities[0][0].id = id;
		return entities[0] //.map(fromDatastore);
    });
    return results;
  //  return results;
}

function get_load(id,req){
    const key = datastore.key([LOAD, parseInt(id,10)]);
    const q = datastore.createQuery(LOAD).filter('__key__', '=', key); 
    console.log(datastore.runQuery(q));
    results = datastore.runQuery(q).then( (entities) => {
		return entities[0]; //.map(fromDatastore);
    });
    return results;
  //  return results;
}


function get_boats(req){
    var q = datastore.createQuery(BOAT).limit(3);
    const results = {};
    var fullUrl = req.protocol + '://' + req.get('host');
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
            results.items = entities[0].map(fromDatastore);

            console.log(entities[0]);
            var index = 0;

            for (let i = 0; i <entities[0].length;i++){  
                
            if(typeof(entities[0][i].loads) != "undefined")    
            entities[0][i].loads.forEach(element => {
                element.self = fullUrl + '/loads/' + element.id;
            });
        }
            if(entities[1].moreResults !==                                          
                Datastore.NO_MORE_RESULTS ){
                results.next = req.protocol + "://" + req.get("host") +  req.baseUrl + "/boats/" + "?cursor=" + entities[1].endCursor;
            }
			return results;
		});
}

async function get_loads(req){
    var q = datastore.createQuery(LOAD).limit(3);
    const results = {};
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
            results.items = entities[0].map(fromDatastore);
            if(entities[1].moreResults !== 
                Datastore.NO_MORE_RESULTS ){
                results.next = req.protocol + "://" + req.get("host") +  req.baseUrl + "/loads/" + "?cursor=" + entities[1].endCursor;
            }
			return results;
		});
}

async function get_loads_for_boat(boat_id,req){
    console.log(boat_id);
    const boat = await get_boat(parseInt(boat_id,10),req);

    arr = []
    for (var i = 0; i < boat[0].loads.length ;i++)
    {          
        var load = await get_load(boat[0].loads[i].id,req);
        boat[0].loads[i].volume = load[0].volume;
        boat[0].loads[i].content =  load[0].content;
        //console.log(boat[0].loads[i])
        //console.log("here we are");
    }

    return boat[0].loads;
}

async function patch_boat(id, name, type, length){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    var boat = {"name": name, "type": type, "length": length};
    
    console.log(boat);
    var x = await datastore.save({"key":key, "data":boat}); 
    console.log(boat);
    return boat;  

}

async function assign_load(boat_id,load_id,req){
    var fullUrl = req.protocol + '://' + req.get('host');
   
    //Update the boat
    const key =  datastore.key([BOAT, parseInt(boat_id,10)]);
    var boat = await get_boat(boat_id,req);
    var temp_loads = boat[0].loads;
    var new_load = {"id": + load_id};  
    temp_loads.push(new_load);
    boat[0].loads = temp_loads; 

     datastore.save({"key":key, "data":boat[0]});
    boat[0].loads.forEach(element => {
            element.self = fullUrl + '/loads/' + element.id;});
    
    //update the load
    var lkey = datastore.key([LOAD, parseInt(load_id,10)]);     
    var load = await get_load(load_id,req);
    var new_boat = {"id":key.id,"name":boat[0].name,"self": fullUrl + '/boats/' + key.id};
    load[0].carrier = new_boat;
    console.log(load[0]);
    datastore.save({"key":lkey, "data":load[0]});

    return boat[0];       
 };


 async function remove_load(boat_id,load_id,req){
    var fullUrl = req.protocol + '://' + req.get('host');
   
    //Update the boat
    const key =  datastore.key([BOAT, parseInt(boat_id,10)]);
    var boat = await get_boat(boat_id,req);
    var temp_loads = boat[0].loads;

    console.log(temp_loads);
    var index =  temp_loads.indexOf(String(load_id));
    console.log(index);
    let i = 0;
    let location = -5;
    temp_loads.forEach(element => {
        if(element.id == load_id)
        {
            location = i;
        }
        i++;

    });

    if(location != -5)
    {
        temp_loads.splice(location,1);
        boat[0].loads = temp_loads;
        datastore.save({"key":key, "data":boat[0]});

    }

    //update the load
    var updated_load = await get_load(load_id,req);
    var lkey = datastore.key([LOAD, parseInt(load_id,10)]);  
    console.log(updated_load);
    updated_load[0].carrier = [];
    datastore.save({"key":lkey, "data":updated_load[0]});
    console.log(updated_load[0]);
 };


async function delete_boat(id,req){
    const key = datastore.key([BOAT, parseInt(id,10)])
    var boat = await get_boat(id,req);
    boat[0].loads.forEach( async function (element) {
        console.log(element.id);
        var updated_load = await get_load(element.id);
        const lkey = datastore.key([LOAD, parseInt(element.id,10)])
        updated_load[0].carrier = [];
        console.log(updated_load);
        datastore.save({"key":lkey, "data":updated_load[0]});
    })

    return datastore.delete(key)         
}; 

async function delete_load(id,req){
    
    const key = datastore.key([LOAD, parseInt(id,10)]);   
    var load = await get_load(id,req);
    //Remove any loads from thier boats
    console.log(load[0]);
//    try{ 
        if(typeof(load[0].carrier) !=  "undefined")
        {
            console.log(load[0].carrier.id);
            //var boat = await get_boat(String(load[0].carrier.id),req);
            await remove_load(String(load[0].carrier.id),String(id),req);

        }//}
  //  catch(error){
        
        console.log("Couldnt find");
 //   }

    return datastore.delete(key);
}


/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

router.get('/boats/:id', function(req, res){    
    var fullUrl = req.protocol + '://' + req.get('host') + '' + req.originalUrl
    const boat = get_boat(req.params.id,req).then( (boat) => {
        boat[0].self = fullUrl;
        //console.log(boat[0])
        res.status(200).json(boat[0]);   
    }).catch( (boat) => {
            console.log("ERRORSSSS");
            var Error = {"Error":"No boat with this boat_id exists"}; 
            res.status(404).send(JSON.stringify(Error));
        }) 
});

router.get('/boats/:id/loads', function(req, res){    
    var fullUrl = req.protocol + '://' + req.get('host') + '' + req.originalUrl
    //var result =  get_loads_for_boat(req.params.id,req).then(    res.status(200).json(result)  );
        const loads = get_loads_for_boat(req.params.id,req)
        .then( (loads) => {
            res.status(200).json(loads);
        });
        console.log(loads);

/*
    const boat = get_boat(req.params.id,req).then( (boat) => {
        boat[0].self = fullUrl;
        //console.log(boat[0]) get_loads_for_boat
        res.status(200).json(boat[0].loads);   
    }).catch( (boat) => {
            console.log("ERRORSSSS");
            var Error = {"Error":"No boat with this boat_id exists"}; 
            res.status(404).send(JSON.stringify(Error));
        }) 
*/
    })



router.get('/loads/:id', function(req, res){    
    var fullUrl = req.protocol + '://' + req.get('host') + '' + req.originalUrl
    console.log(req.params.id);
    const load = get_load(req.params.id).then( (load) => {
        load[0].self = fullUrl;
        console.log(load[0])
        res.status(200).json(load[0]);   
    }).catch( (load) => {
            console.log("ERRORSSSS");
            var Error = {"Error":"No boat with this boat_id exists"}; 
            res.status(404).send(JSON.stringify(Error));
        }) 
});


/* 
router.get('/boats', function(req, res){
    const boats = get_boats().then( (boats) => {
        res.status(200).json(boats);
    });
});
*/

router.get('/boats', function(req, res){
    const boats = get_boats(req)
	.then( (boats) => {
        res.status(200).json(boats);
    });
});

router.get('/loads', function(req, res){
    const loads = get_loads(req)
	.then( (loads) => {       
        res.status(200).json(loads);
    });
});

router.post('/boats', function(req, res){ 
    if(typeof(req.body.name) == "undefined" || typeof(req.body.type) == "undefined" ||  typeof(req.body.length) == "undefined")
    {
        var Error = {"Error":"The request object is missing at least one of the required attributes"}; 
        res.status(400).send(JSON.stringify(Error));
    } else {
        //var boat = {"name": req.body.name, "type": req.body.type, "length": req.body.length};
        //post_boat(req.body.name, req.body.type, req.body.length,req.body.loads);
        //console.log(boat);

        post_boat(req.body.name,req.body.type,req.body.length).then( boat => {
            boat.self = req.protocol + '://' + req.get('host') + '' + req.originalUrl + '/' + boat.id; 
            console.log(boat);                   
            res.status(201).send(JSON.stringify(boat)); 
        })
    }
        //post_boat(req.body.name,req.body.type,req.body.length).then( key => {res.status(201).send('{ "id": ' + key.id + ' }')} );
    
});

router.post('/loads', function(req, res){ 
    if(typeof(req.body.volume) == "undefined" || typeof(req.body.content) == "undefined")
    {
        var Error = {"Error":"The request object is missing at least one of the required attributes"}; 
        res.status(400).send(JSON.stringify(Error));
    } else {
        post_load(req.body.volume,req.body.content).then( load => {
            load.self = req.protocol + '://' + req.get('host') + '' + req.originalUrl + '/' + load.id; 
            console.log(load);                   
            res.status(201).send(JSON.stringify(load)); 
        })
    }   
});

router.patch('/boats/:id', function(req, res){    
    if(typeof(req.body.name) == "undefined" || typeof(req.body.type) == "undefined" ||  typeof(req.body.length) == "undefined")
    {
        var Error = {"Error":"The request object is missing at least one of the required attributes"}; 
        res.status(400).send(JSON.stringify(Error));
    } else {
    console.log("Patch Request Recieved")
    var boat = patch_boat(req.params.id, req.body.name, req.body.type, req.body.length);
    boat.self = req.protocol + '://' + req.get('host') + '' + req.originalUrl;
    res.status(200).send(JSON.stringify(boat));   
    }
});


router.put('/boats/:boat_id/loads/:load_id', function(req, res){    

    //Adding Load to Boat
    console.log("Here we are");
    var r = assign_load(req.params.boat_id,req.params.load_id,req);
    console.log("After return");
    console.log(r);
    //var return_code = boat_arrive(req.params.slip_id, req.params.boat_id);
    //console.log(return_code);

    
    res.status(204).send(JSON.stringify(r));   
});

//Remove assignment
router.delete('/boats/:boat_id/loads/:load_id', function(req, res){    

    //Adding Load to Boat
    console.log("Here we are");
    var r = remove_load(req.params.boat_id,req.params.load_id,req);
    console.log("After return");
    console.log(r);
    //var return_code = boat_arrive(req.params.slip_id, req.params.boat_id);
    //console.log(return_code);

    
    res.status(204).send(JSON.stringify(r));   
});


router.delete('/boats/:id', function(req, res){
    var Error = {"Error":"The request object is missing at least one of the required attributes"}; 
    //delete_boat(req.params.id).then(res.status(204)).catch(res.status(404))    
    //delete_boat(req.params.id)//.then(res.status(204))//.catch((a) => {})  
    //res.status(204);
    delete_boat(req.params.id,req).then(res.status(204).end())    
    //delete_lodging(req.params.id).then(res.status(200).end())
});

router.delete('/loads/:id', function(req, res){
    var Error = {"Error":"The request object is missing at least one of the required attributes"}; 
    //delete_boat(req.params.id).then(res.status(204)).catch(res.status(404))    
    //delete_boat(req.params.id)//.then(res.status(204))//.catch((a) => {})  
    //res.status(204);
    delete_load(req.params.id,req).then(res.status(204)).catch(res.status(404).end())    
    //delete_lodging(req.params.id).then(res.status(200).end())
});

/* ------------- End Controller Functions ------------- */

app.use('', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
