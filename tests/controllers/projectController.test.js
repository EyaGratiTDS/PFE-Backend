const projectController = require('../../controllers/ProjectController');
const Project = require('../../models/Project');
const User = require('../../models/User');
const VCard = require('../../models/Vcard');
const { deleteFileIfExists } = require('../../services/cloudinary');
const fs = require('fs');

jest.mock('../../models/Project');
jest.mock('../../models/User'); 
jest.mock('../../models/Vcard');
jest.mock('../../models/Subscription');
jest.mock('../../models/Plan');
jest.mock('../../services/cloudinary');
jest.mock('fs');
jest.mock('path');

describe('Project Controller', () => {
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {},
      protocol: 'http',
      get: jest.fn(() => 'localhost:3000'),
      file: null
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      end: jest.fn()
    };

    // Mock fs.unlink and cloudinary deleteFileIfExists
    fs.unlink.mockImplementation((path, callback) => {
      if (callback) callback(null);
    });
    deleteFileIfExists.mockImplementation(() => Promise.resolve());

    jest.clearAllMocks();
  });

  describe('createProject', () => {
    const validProjectData = {
      name: 'Test Project',
      description: 'Test Description',
      color: '#000000',
      userId: 1
    };

    test('should create project successfully', async () => {
      mockRequest.body = validProjectData;
      mockRequest.file = { filename: 'test-logo.jpg' };
      
      const mockUser = { id: 1, name: 'Test User' };
      User.findByPk.mockResolvedValue(mockUser);

      const mockCreatedProject = { id: 1, ...validProjectData, logo: '/uploads/test-logo.jpg' };
      Project.create.mockResolvedValue(mockCreatedProject);

      await projectController.createProject(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockCreatedProject);
    });

    test('should return 400 if required fields are missing', async () => {
      mockRequest.body = { description: 'Test' };

      await projectController.createProject(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: expect.stringContaining('mandatory')
      });
    });

    test('should return 404 if user not found', async () => {
      mockRequest.body = validProjectData;
      User.findByPk.mockResolvedValue(null);

      await projectController.createProject(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'User not found'
      });
    });
  });

  describe('getProjectById', () => {
    test('should return project if found', async () => {
      const mockProject = { id: 1, name: 'Test Project' };
      mockRequest.params.id = 1;
      Project.findByPk.mockResolvedValue(mockProject);

      await projectController.getProjectById(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(mockProject);
    });

    test('should return 404 if project not found', async () => {
      mockRequest.params.id = 999;
      Project.findByPk.mockResolvedValue(null);

      await projectController.getProjectById(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateProject', () => {
    const updateData = {
      name: 'Updated Project',
      description: 'Updated Description',
      userId: 1
    };

    test('should update project successfully', async () => {
      mockRequest.params.id = 1;
      mockRequest.body = updateData;
      
      const mockProject = { 
        id: 1, 
        name: 'Old Name',
        logo: '/uploads/old-logo.jpg'
      };
      Project.findByPk.mockResolvedValue(mockProject);
      User.findByPk.mockResolvedValue({ id: 1 });
      Project.update.mockResolvedValue([1]);

      await projectController.updateProject(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalled();
    });

    test('should handle logo removal', async () => {
      mockRequest.params.id = 1;
      mockRequest.body = { 
        ...updateData,
        removeLogo: 'true'
      };

      const mockProject = {
        id: 1,
        logo: '/uploads/old-logo.jpg',
        logoPublicId: 'old-logo-public-id'
      };
      Project.findByPk.mockResolvedValue(mockProject);
      User.findByPk.mockResolvedValue({ id: 1 });
      Project.update.mockResolvedValue([1]);
      Project.findByPk.mockResolvedValueOnce(mockProject); // for the final fetch

      await projectController.updateProject(mockRequest, mockResponse);

      expect(deleteFileIfExists).toHaveBeenCalledWith('old-logo-public-id');
    });
  });

  describe('deleteProject', () => {
    test('should delete project successfully', async () => {
      mockRequest.params.id = 1;
      
      const mockProject = {
        id: 1,
        destroy: jest.fn()
      };
      Project.findByPk.mockResolvedValue(mockProject);

      await projectController.deleteProject(mockRequest, mockResponse);

      expect(mockProject.destroy).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(204);
    });
  });

  describe('getProjectsByUserId', () => {
    test('should return user projects', async () => {
      mockRequest.query.userId = 1;
      
      const mockProjects = [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' }
      ];
      Project.findAll.mockResolvedValue(mockProjects);

      await projectController.getProjectsByUserId(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(mockProjects);
    });

    test('should validate userId parameter', async () => {
      mockRequest.query = {};

      await projectController.getProjectsByUserId(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getVCardsByProject', () => {
    test('should return project vcards with transformed URLs', async () => {
      mockRequest.params.id = 1;
      
      const mockProject = { id: 1 };
      Project.findByPk.mockResolvedValue(mockProject);

      const mockVCards = [{
        id: 1,
        logo: '/logo.jpg',
        background_type: 'custom-image',
        background_value: '/bg.jpg',
        get: () => ({
          id: 1,
          logo: '/logo.jpg',
          background_type: 'custom-image',
          background_value: '/bg.jpg'
        })
      }];
      VCard.findAll.mockResolvedValue(mockVCards);

      await projectController.getVCardsByProject(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        count: 1
      }));
    });
  });

  describe('getAllProjectsWithUser', () => {
    test('should return all projects with user data', async () => {
      const mockProjects = [
        { 
          id: 1,
          name: 'Project 1',
          Users: { id: 1, name: 'User 1' }
        }
      ];
      Project.findAll.mockResolvedValue(mockProjects);

      await projectController.getAllProjectsWithUser(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        count: 1,
        data: mockProjects
      }));
    });
  });

  describe('toggleProjectBlocked', () => {
    test('should toggle project blocked status', async () => {
      mockRequest.params.id = 1;
      
      const mockProject = {
        id: 1,
        is_blocked: false
      };
      Project.findByPk
        .mockResolvedValueOnce(mockProject)
        .mockResolvedValueOnce({ ...mockProject, is_blocked: true });
      
      Project.update.mockResolvedValue([1]);

      await projectController.toggleProjectBlocked(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: expect.stringContaining('blocked')
      }));
    });
  });
});