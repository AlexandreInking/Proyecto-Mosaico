namespace Mosaico.Core;

public interface IEditorCommand
{
    void Execute(MapDocument document);
    void Undo(MapDocument document);
}

public sealed class PaintCellsCommand(IEnumerable<GridCoordinate> cells, int tileId) : IEditorCommand
{
    private readonly GridCoordinate[] _cells = cells.Distinct().ToArray();
    private readonly int _tileId = tileId;
    private Dictionary<GridCoordinate, int>? _previous;

    public void Execute(MapDocument document)
    {
        _previous ??= _cells.ToDictionary(cell => cell, document.GetTile);
        foreach (var cell in _cells)
        {
            document.SetTile(cell, _tileId);
        }
    }

    public void Undo(MapDocument document)
    {
        if (_previous is null)
        {
            throw new InvalidOperationException("Cannot undo a command that has not executed.");
        }
        foreach (var pair in _previous)
        {
            document.SetTile(pair.Key, pair.Value);
        }
    }
}

public sealed class CommandHistory(MapDocument document)
{
    private readonly Stack<IEditorCommand> _undo = [];
    private readonly Stack<IEditorCommand> _redo = [];

    public bool CanUndo => _undo.Count > 0;
    public bool CanRedo => _redo.Count > 0;

    public void Execute(IEditorCommand command)
    {
        command.Execute(document);
        _undo.Push(command);
        _redo.Clear();
    }

    public bool Undo()
    {
        if (!_undo.TryPop(out var command))
        {
            return false;
        }
        command.Undo(document);
        _redo.Push(command);
        return true;
    }

    public bool Redo()
    {
        if (!_redo.TryPop(out var command))
        {
            return false;
        }
        command.Execute(document);
        _undo.Push(command);
        return true;
    }
}
