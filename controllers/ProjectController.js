const Project = require("../models/Project");
const { getActiveBlockLimit, getProjectLimits } = require('../middleware/planLimiter');
const User = require('../models/User');
const VCard = require("../models/Vcard");
const Subscription = require("../models/Subscription");
const Plan = require("../models/Plan");
const { deleteFileIfExists } = require("../services/cloudinary");

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
      logo: logoFile ? logoFile.path : null,         // URL Cloudinary
      logoPublicId: logoFile ? logoFile.filename : null // Public ID Cloudinary
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

    // 📌 Nouveau logo
    if (logoFile) {
      if (project.logoPublicId) {
        await deleteFileIfExists(project.logoPublicId);
      }
      updateData.logo = logoFile.path;
      updateData.logoPublicId = logoFile.filename;
    }
    // 📌 Suppression du logo
    else if (removeLogo === 'true') {
      if (project.logoPublicId) {
        await deleteFileIfExists(project.logoPublicId);
      }
      updateData.logo = null;
      updateData.logoPublicId = null;
    }

    await Project.update(updateData, {
      where: { id: req.params.id }
    });

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

    if (project.logoPublicId) {
      await deleteFileIfExists(project.logoPublicId);
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
        userId: userId,
        is_blocked: false
      }
    });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

const getVCardsByProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const vcards = await VCard.findAll({
      where: { projectId: id },
      include: [
        {
          model: User,
          as: 'Users',
          include: [{
            model: Subscription,
            as: 'Subscription',
            where: { status: 'active' },
            include: [{
              model: Plan,
              as: 'Plan'
            }],
            required: false
          }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const enhancedVCards = vcards.map(vcard => ({
      ...vcard.get({ plain: true }),
      logo: vcard.logo || null,
      favicon: vcard.favicon || null,
      background_value: vcard.background_type === 'custom-image'
        ? vcard.background_value
        : vcard.background_value
    }));

    res.json({
      success: true,
      count: enhancedVCards.length,
      data: enhancedVCards
    });

  } catch (error) {
    console.error("Error retrieving project's vCards:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const getAllProjectsWithUser = async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: [
        {
          model: User,
          as: 'Users', 
          attributes: ['id', 'name', 'email'] 
        }
      ],
      order: [['createdAt', 'DESC']] 
    });
    res.json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Error retrieving projects with users:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const toggleProjectBlocked = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updatedIsBlocked = !project.is_blocked;
    
    await Project.update(
      { is_blocked: updatedIsBlocked },
      { where: { id: req.params.id } }
    );

    const updatedProject = await Project.findByPk(req.params.id);
    
    res.json({
      success: true,
      message: `Project ${updatedIsBlocked ? 'blocked' : 'unblocked'} successfully`,
      data: updatedProject
    });

  } catch (error) {
    console.error('Error toggling project blocked status:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: error.message
    });
  }
};

module.exports = {
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectsByUserId,
  getVCardsByProject,
  getAllProjectsWithUser,
  toggleProjectBlocked
};