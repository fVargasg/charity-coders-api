// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

// pull in Mongoose model for projects
const Project = require('../models/project')

// we'll use this to intercept any errors that get thrown and send them
// back to the client with the appropriate status code
const handle = require('../../lib/error_handler')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `res.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// INDEX
// GET /projects
router.get('/projects/:id', (req, res) => {
  Project.find({ owner: req.params.id })
    .then(projects => {
      // `projects` will be an array of Mongoose documents
      // we want to convert each one to a POJO, so we use `.map` to
      // apply `.toObject` to each one
      return projects.map(project => project.toObject())
    })
    // respond with status 200 and JSON of the projects
    .then(projects => res.status(200).json({ projects: projects }))
    // if an error occurs, pass it to the handler
    .catch(err => handle(err, res))
})


router.get('/projects', requireToken, (req, res) => {
  // req.params.id will be set based on the `:id` in the route
  Project.find()
  .then(projects => {
    // `examples` will be an array of Mongoose documents
    // we want to convert each one to a POJO, so we use `.map` to
    // apply `.toObject` to each one
    return projects.map(project => project.toObject())
  })
  // respond with status 200 and JSON of the projects
  .then(projects => res.status(200).json({ projects: projects }))
  // if an error occurs, pass it to the handler
  .catch(err => handle(err, res))
})

// CREATE
// POST /projects
router.post('/projects', requireToken, (req, res) => {
  // set owner of new project to be current user
  req.body.project.owner = req.body.project.organization_id

  Project.create(req.body.project)
    // respond to succesful `create` with status 201 and JSON of new "project"
    .then(project => {
      res.status(201).json({ project: project.toObject() })
    })
    // if an error occurs, pass it off to our error handler
    // the error handler needs the error message and the `res` object so that it
    // can send an error message back to the client
    .catch(err => handle(err, res))
})

// UPDATE
// PATCH /projects/5a7db6c74d55bc51bdf39793
router.patch('/projects/:id', requireToken, (req, res) => {
  // if the client attempts to change the `owner` property by including a new
  // owner, prevent that by deleting that key/value pair
  delete req.body.project.owner

  Project.findById(req.params.id)
    .then(handle404)
    .then(project => {
      // pass the `req` object and the Mongoose record to `requireOwnership`
      // it will throw an error if the current user isn't the owner
      requireOwnership(req, project)

      // the client will often send empty strings for parameters that it does
      // not want to update. We delete any key/value pair where the value is
      // an empty string before updating
      Object.keys(req.body.project).forEach(key => {
        if (req.body.project[key] === '') {
          delete req.body.project[key]
        }
      })

      // pass the result of Mongoose's `.update` to the next `.then`
      return project.update(req.body.project)
    })
    // if that succeeded, return 204 and no JSON
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(err => handle(err, res))
})

// DESTROY
// DELETE /projects/5a7db6c74d55bc51bdf39793
router.delete('/projects/:id', requireToken, (req, res) => {
  Project.findById(req.params.id)
    .then(handle404)
    .then(project => {
      // throw an error if current user doesn't own `project`
      requireOwnership(req, project)
      // delete the project ONLY IF the above didn't throw
      project.remove()
    })
    // send back 204 and no content if the deletion succeeded
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(err => handle(err, res))
})

module.exports = router
