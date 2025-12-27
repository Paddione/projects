import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { apiService } from '../../services/apiService'

// Mock child components to keep tests focused and fast
jest.mock('../LoadingSpinner', () => ({
	LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>
}))

// AI generator removed; no mock needed

// Mock the API service methods used by QuestionSetManager
jest.mock('../../services/apiService', () => ({
	apiService: {
		getQuestionSets: jest.fn(),
		getQuestionSetDetails: jest.fn(),
		getQuestionSetStats: jest.fn(),
		createQuestionSet: jest.fn(),
		updateQuestionSet: jest.fn(),
		deleteQuestionSet: jest.fn(),
		importQuestionSet: jest.fn(),
		exportQuestionSet: jest.fn(),
		// unused here but required by TS shape in other tests
		getFiles: jest.fn(),
		testGeminiConnection: jest.fn(),
		testChromaConnection: jest.fn(),
		getChromaStats: jest.fn(),
		getToken: jest.fn(() => 'test-token')
	}
}))

import { QuestionSetManager } from '../QuestionSetManager'

const mockApi = apiService as jest.Mocked<typeof apiService>

function renderManager() {
	return render(<QuestionSetManager />)
}

const baseSet = {
	id: 1,
	name: 'Set A',
	description: 'Desc A',
	category: 'Science',
	difficulty: 'medium',
	is_active: true
}

const secondSet = {
	id: 2,
	name: 'Set B',
	description: 'Desc B',
	category: 'History',
	difficulty: 'easy',
	is_active: true
}

describe('QuestionSetManager', () => {
	beforeEach(() => {
		jest.clearAllMocks()

		mockApi.getQuestionSets.mockResolvedValue({
			success: true,
			data: [baseSet, secondSet] as any
		})
		mockApi.getQuestionSetDetails.mockResolvedValue({
			success: true,
			data: {
				...baseSet,
				questions: [
					{ id: 101, question_text: 'Q1', answers: [{ text: 'A1', correct: true }], explanation: 'E1', difficulty: 1 }
				]
			}
		} as any)
		mockApi.getQuestionSetStats.mockResolvedValue({
			success: true,
			data: {
				total_questions: 1,
				avg_difficulty: 1.0,
				min_difficulty: 1,
				max_difficulty: 1
			}
		})
	})

	it('loads and lists question sets', async () => {
		await act(async () => { renderManager() })

		await waitFor(() => {
			expect(mockApi.getQuestionSets).toHaveBeenCalled()
			expect(screen.getByText('Set A')).toBeInTheDocument()
			expect(screen.getByText('Set B')).toBeInTheDocument()
		})
	})

	it('selects a set and shows details and stats', async () => {
		await act(async () => { renderManager() })
		await waitFor(() => expect(screen.getByText('Set A')).toBeInTheDocument())

		fireEvent.click(screen.getByText('Set A'))

		await waitFor(() => {
			expect(mockApi.getQuestionSetDetails).toHaveBeenCalledWith(1)
			expect(mockApi.getQuestionSetStats).toHaveBeenCalledWith(1)
			expect(screen.getByText('Statistics')).toBeInTheDocument()
			expect(screen.getByText('Total Questions')).toBeInTheDocument()
			expect(screen.getByText('1')).toBeInTheDocument()
			// Verify the questions section reflects the count to avoid ambiguous text matches
			expect(screen.getByText('Questions (1)')).toBeInTheDocument()
		})
	})

// Create New Set flow removed; test omitted

	it('updates an existing question set', async () => {
		mockApi.updateQuestionSet.mockResolvedValue({
			success: true,
			data: { id: 1, name: 'Updated Set', description: 'Updated Desc', category: 'Science', difficulty: 'medium', is_active: true } as any
		})

		await act(async () => { renderManager() })
		await waitFor(() => expect(screen.getByText('Set A')).toBeInTheDocument())
		// open set to make sure selected
		fireEvent.click(screen.getByText('Set A'))

		// Click the edit button (has title="Edit") on the selected list item
		const editButton = await screen.findAllByTitle('Edit')
		fireEvent.click(editButton[0])

		// Change name and submit
		fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated Set' } })
		fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Updated Desc' } })
		fireEvent.click(screen.getByRole('button', { name: 'Update' }))

		await waitFor(() => {
			expect(mockApi.updateQuestionSet).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Updated Set' }))
			// Check for multiple "Updated Set" texts since it appears in both list and detail view
			const updatedTexts = screen.getAllByText('Updated Set')
			expect(updatedTexts.length).toBeGreaterThan(0)
		})
	})

	it('deletes a question set after confirmation', async () => {
		mockApi.deleteQuestionSet.mockResolvedValue({ success: true, data: { message: 'ok' } } as any)
		const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

		await act(async () => { renderManager() })
		await waitFor(() => expect(screen.getByText('Set A')).toBeInTheDocument())

		const deleteButtons = screen.getAllByTitle('Delete')
		fireEvent.click(deleteButtons[0])

		await waitFor(() => {
			expect(confirmSpy).toHaveBeenCalled()
			expect(mockApi.deleteQuestionSet).toHaveBeenCalledWith(1)
		})
	})

	it('imports a question set from valid JSON', async () => {
		mockApi.importQuestionSet.mockResolvedValue({ success: true, data: { message: 'ok' } } as any)

		await act(async () => { renderManager() })
		await waitFor(() => expect(screen.getByText('Import Set')).toBeInTheDocument())

		fireEvent.click(screen.getByText('Import Set'))
		const json = {
			questions: [
				{ question: 'Q1', correctAnswer: 'A', incorrectAnswers: ['B', 'C', 'D'], explanation: 'E', difficulty: 'easy', category: 'Science' }
			]
		}
		fireEvent.change(screen.getByLabelText('JSON Data'), { target: { value: JSON.stringify(json) } })
		fireEvent.click(screen.getByRole('button', { name: 'Import' }))

		await waitFor(() => {
			expect(mockApi.importQuestionSet).toHaveBeenCalled()
		})
	})

	it('shows error on invalid JSON import', async () => {
		await act(async () => { renderManager() })
		await waitFor(() => expect(screen.getByText('Import Set')).toBeInTheDocument())

		fireEvent.click(screen.getByText('Import Set'))
		fireEvent.change(screen.getByLabelText('JSON Data'), { target: { value: '{ invalid json }' } })
		fireEvent.click(screen.getByRole('button', { name: 'Import' }))

		await waitFor(() => {
			expect(screen.getByText(/Ungültiges JSON-Format/i)).toBeInTheDocument()
		})
	})

	it('exports a question set (calls API and triggers download)', async () => {
		mockApi.exportQuestionSet.mockResolvedValue({ success: true, data: { questionSet: baseSet, questions: [] } } as any)

		// Mock URL constructor and methods properly
		const mockCreateObjectURL = jest.fn(() => 'blob://download')
		const mockRevokeObjectURL = jest.fn()

		// Mock the global URL constructor
		global.URL = {
			createObjectURL: mockCreateObjectURL,
			revokeObjectURL: mockRevokeObjectURL
		} as any

		// Spy on anchor creation to avoid actually clicking
		const createElementSpy = jest.spyOn(document, 'createElement')
		createElementSpy.mockImplementation(((tagName: string) => {
			const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as any
			element.click = jest.fn()
			return element
		}) as any)

		await act(async () => { renderManager() })
		await waitFor(() => expect(screen.getByText('Set A')).toBeInTheDocument())

		// open set to make export button easier to target
		fireEvent.click(screen.getByText('Set A'))

		// Wait for loading to complete and the set details to be loaded
		await waitFor(() => {
			// Check that we're no longer loading by ensuring the loading spinner is gone
			expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
		})

		const exportButtons = screen.getAllByTitle('Export')
		fireEvent.click(exportButtons[0])

		await waitFor(() => {
			expect(mockApi.exportQuestionSet).toHaveBeenCalledWith(1)
			expect(mockCreateObjectURL).toHaveBeenCalled()
			expect(mockRevokeObjectURL).toHaveBeenCalled()
		})

		// Cleanup: restore original URL
		delete (global as any).URL
	})

// AI Generator removed; test omitted
})
