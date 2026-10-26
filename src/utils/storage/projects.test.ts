import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from './projects';
import { IActiveItemManager } from './ActiveItemManager';
import { ProjectInfo } from '../../types';
import { GeneralSettingsService } from './general';

describe('ProjectService', () => {
  let mockActiveItemManager: IActiveItemManager<ProjectInfo>;
  let mockGeneralSettingsService: GeneralSettingsService;

  beforeEach(() => {
    mockActiveItemManager = {
      getItems: vi.fn().mockReturnValue([]),
      getActiveId: vi.fn().mockReturnValue(null),
      setActiveId: vi.fn(),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getSnapshot: vi.fn().mockReturnValue({ activeItem: null }),
      collection: {
        save: vi.fn(),
        upsert: vi.fn(),
      },
    } as unknown as IActiveItemManager<ProjectInfo>;

    mockGeneralSettingsService = {
      saveStoredApiKey: vi.fn(),
    } as unknown as GeneralSettingsService;
  });

  it('loads stored projects', () => {
    const projects = [{ id: 'proj1', name: 'Proj 1' } as ProjectInfo];
    vi.mocked(mockActiveItemManager.getItems).mockReturnValue(projects);
    const service = new ProjectService({
      generalSettingsService: mockGeneralSettingsService,
      projectsManager: mockActiveItemManager
    });

    expect(service.loadStoredProjects()).toEqual(projects);
  });

  it('saves stored projects', () => {
    const service = new ProjectService({
      generalSettingsService: mockGeneralSettingsService,
      projectsManager: mockActiveItemManager
    });
    const projects = [{ id: 'proj1', name: 'Proj 1' } as ProjectInfo];
    service.saveStoredProjects(projects);
    expect(mockActiveItemManager.collection.save).toHaveBeenCalledWith(projects);
  });

  it('gets and sets active project id', () => {
    const service = new ProjectService({
      generalSettingsService: mockGeneralSettingsService,
      projectsManager: mockActiveItemManager
    });

    vi.mocked(mockActiveItemManager.getActiveId).mockReturnValue('proj1');
    expect(service.getActiveProjectId()).toBe('proj1');

    service.setActiveProjectId('proj2');
    expect(mockActiveItemManager.setActiveId).toHaveBeenCalledWith('proj2');
  });

  it('saves and activates project, generating ID if none provided', () => {
    const service = new ProjectService({
      generalSettingsService: mockGeneralSettingsService,
      projectsManager: mockActiveItemManager
    });

    const projectData = {
      name: '  Test Project  ',
      apiKey: '  some-api-key  '
    };

    const saved = service.saveAndActivateProject(projectData as ProjectInfo);

    expect(saved.id).toMatch(/^proj_/);
    expect(saved.name).toBe('Test Project');
    expect(saved.apiKey).toBe('some-api-key');
    expect(saved.defaultModel).toBe('gemini-2.5-flash');
    expect(saved.createdAt).toBeTypeOf('number');

    expect(mockActiveItemManager.collection.upsert).toHaveBeenCalledWith(saved, false);
    expect(mockActiveItemManager.setActiveId).toHaveBeenCalledWith(saved.id);
  });

  it('saves and activates project using provided ID', () => {
    const service = new ProjectService({
      generalSettingsService: mockGeneralSettingsService,
      projectsManager: mockActiveItemManager
    });

    const projectData = {
      id: 'custom_id',
      name: 'Test Project',
      apiKey: 'some-api-key'
    };

    const saved = service.saveAndActivateProject(projectData as ProjectInfo);
    expect(saved.id).toBe('custom_id');
  });
});
