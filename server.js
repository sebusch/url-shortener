/* eslint one-var: "none", no-console: "none" */
var express = require( 'express' );
var monk = require( 'monk' );
var mongoURI = process.env.MONGOLAB_URI;

var app = express();

var port = process.env.PORT || 8080;


const db = monk( mongoURI );
db.catch( ( err ) => {
  // error connecting to the database
  app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Sorry there is an error connecting to the database');
  });
} );

const collection = db.get( 'urls' )


app.set( 'view options', {
  layout: false
} );
app.use( express.static( __dirname + '/public' ) );

app.get( '/new/*', validateUrl, queryDB );


app.get( '/:shortcut', redirectDB );

app.get( '/', function( req, res, next ) {
  res.render( 'index.html' );
} );

app.use( myErrorHandler );

app.listen( port, function() {
  console.log( 'Example app listening on port %d!', port );
} );


function myErrorHandler( err, req, res, next ) {
  res.send({ error: err.message });
  next(err);
}

function redirectDB( req, res ) {

  collection
    .findOne( { short_url: req.params.shortcut } )
    .then( ( doc ) => {
      if ( doc ) {
        res.redirect( doc.original_url );
      } else {
        res.send( 'sorry, ' + req.params.shortcut + ' is not a valid bookmark.' );
      }
    } )
    .catch((err) => {
      res.send( 'there was a server-side error with the database');
    });
}


function validateUrl( req, res, next ) {
  if ( re_weburl.test( req.params[ 0 ] ) ) {
    next();
  } else {
    next( new Error( 'That is not a valid url. Remember to include http:// or https://' ) );
  }
}

function queryDB( req, res, next ) {
  collection.findOneAndUpdate(
    {
      original_url: req.params[ 0 ] 
    },
    {
      $setOnInsert:  { 
        original_url: req.params[ 0 ],
        short_url: getID()
      }
    },
    {
      projection: { _id: 0 },
      new: true,   // return new doc if one is upserted
      upsert: true // insert the document if it does not exist
    }
    ).then( ( doc ) => {
    res.send( doc );
  } ).catch( ( err ) => {
    // An error happened while inserting
    next( new Error('error while inserting into db') );
  } );
}



function processInput( input ) {
  if ( re_weburl.test( input ) ) {
    return input + ' is a valid url';
  } else {
    return 'That is not a valid url. Remember to include http:// or https://';
  }
}


// https://gist.github.com/dperini/729294
var re_weburl = new RegExp(
  '^' +
  // protocol identifier
  '(?:(?:https?|ftp)://)' +
  // user:pass authentication
  '(?:\\S+(?::\\S*)?@)?' +
  '(?:' +
  // IP address exclusion
  // private & local networks
  '(?!(?:10|127)(?:\\.\\d{1,3}){3})' +
  '(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})' +
  '(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})' +
  // IP address dotted notation octets
  // excludes loopback network 0.0.0.0
  // excludes reserved space >= 224.0.0.0
  // excludes network & broacast addresses
  // (first & last IP address of each class)
  '(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' +
  '(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' +
  '(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' +
  '|' +
  // host name
  '(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)' +
  // domain name
  '(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*' +
  // TLD identifier
  '(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))' +
  // TLD may end with dot
  '\\.?' +
  ')' +
  // port number
  '(?::\\d{2,5})?' +
  // resource path
  '(?:[/?#]\\S*)?' +
  '$', 'i'
);

var BASE10 = '0123456789';
var BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
var BASE56 = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
function convert( src, srctable, desttable ) {
  var srclen = srctable.length;
  var destlen = desttable.length;
  var val = 0;
  var numlen = src.length;
  for ( var i = 0; i < numlen; i++ ) {
    val = val * srclen + srctable.indexOf( src.charAt( i ) );
  }
  if ( val < 0 ) {
    return 0;
  }
  var r = val % destlen;
  var res = desttable.charAt( r );
  var q = Math.floor( val / destlen );
  while ( q ) {
    r = q % destlen;
    q = Math.floor( q / destlen );
    res = desttable.charAt( r ) + res;
  }
  return res;
}

function getID() {
  var time = new Date();
  var offset = time.getTime() - 1470000000000;
  if ( offset < 0 ) {
    offset = -offset;
  }
  var result = convert( offset.toString(), BASE10, BASE56 );
  return result;
}