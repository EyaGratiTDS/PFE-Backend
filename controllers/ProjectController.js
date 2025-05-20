const Project = require("../models/Project");
const { getActiveBlockLimit, getProjectLimits } = require('../middleware/planLimiter');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

const createProject = async (req, res) => {
  try {
    const { name, description, color, status, userId } = req.body;
    const logoFile = req.file;

    if (!name || !userId) {
      return res.status(400).json({
        message: "The 'name' and 'userId' fields are mandatory"
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    const projectData = {
      name,
      description,
     color,
      status: status || 'active',
      userId,
      logo: logoFile ? `/uploads/${logoFile.filename}` : null
    };

    const newProject = await Project.create({...projectData});

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
};

const getVCardsByProjectId = async (req, res) => { //reste non fonctionnel
  try {
    const { vcardId } = req.query;
    const userId = req.user.id;

    if (!vcardId) {
      return res.status(400).json({ error: 'vcardId est requis' });
    }

    const blocks = await Project.findAll({
      where: { vcardId },
      order: [['createdAt', 'ASC']]
    });

    const maxActive = await getActiveBlockLimit(userId, vcardId);

    const result = blocks.map((block, index) => ({
      ...block.get({ plain: true }),
      isDisabled: index >= maxActive
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching blocks:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error retrieving Project:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { name, description, color, status, removeLogo } = req.body;
    const logoFile = req.file;
    const userId = req.body.userId;

    if (!name) {
      return res.status(400).json({ error: "Project name is required" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updateData = {
      name,
      description: description || project.description,
      color: color || project.color,
      status: status || project.status,
      userId
    };

    if (logoFile) {
      if (project.logo) {
        const oldLogoPath = path.join(__dirname, '..', 'public', project.logo);
        fs.unlink(oldLogoPath, (err) => {
          if (err) console.error('Error deleting old logo:', err);
        });
      }
      updateData.logo = `/uploads/${logoFile.filename}`;
    } else if (removeLogo === 'true') {
      if (project.logo) {
        const oldLogoPath = path.join(__dirname, '..', 'public', project.logo);
        fs.unlink(oldLogoPath, (err) => {
          if (err) console.error('Error deleting old logo:', err);
        });
      }
      updateData.logo = null;
    }

    const [updatedRows] = await Project.update(updateData, {
      where: { id: req.params.id },
      returning: true
    });

    if (updatedRows === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updatedProject = await Project.findByPk(req.params.id);
    
    res.json(updatedProject);

  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
};

const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await project.destroy();
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getProjectsByUserId = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const projects = await Project.findAll({
      where: {
        userId: userId
      }
    });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
module.exports = {
  createProject,
  getVCardsByProjectId,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectsByUserId
};